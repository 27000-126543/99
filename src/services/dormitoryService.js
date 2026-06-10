const Bed = require('../models/Bed');
const Dormitory = require('../models/Dormitory');
const Building = require('../models/Building');
const DormitoryAssignment = require('../models/DormitoryAssignment');
const TransferRequest = require('../models/TransferRequest');
const NotificationService = require('./notificationService');
const { AppError } = require('../middleware/errorHandler');

class DormitoryService {
  static async smartMatchDormitory(student) {
    const { gender, major, sleepPreference } = student.studentInfo;

    const buildings = await Building.find({
      $or: [{ gender: gender }, { gender: 'mixed' }],
    });

    if (!buildings.length) {
      throw new AppError('暂无符合性别要求的楼栋', 404);
    }

    const buildingIds = buildings.map((b) => b._id);

    let dormitories = await Dormitory.find({
      buildingId: { $in: buildingIds },
      occupiedCount: { $lt: 4 },
      selectionLocked: false,
    }).populate('buildingId');

    const scoredDormitories = dormitories.map((dorm) => {
      let score = 0;
      const criteria = { major: false, gender: true, sleepPreference: false };

      if (dorm.allowedMajors.length === 0 || dorm.allowedMajors.includes(major)) {
        score += 40;
        criteria.major = true;
      }

      if (dorm.occupiedCount > 0) {
        score += 20;
      } else {
        score += 10;
      }

      score += dorm.comprehensiveScore * 0.2;

      return {
        dormitory: dorm,
        score,
        criteria,
      };
    });

    scoredDormitories.sort((a, b) => b.score - a.score);

    for (const item of scoredDormitories) {
      const availableBed = await Bed.findOne({
        dormitoryId: item.dormitory._id,
        status: 'available',
      });

      if (availableBed) {
        return {
          dormitory: item.dormitory,
          bed: availableBed,
          matchScore: item.score,
          matchCriteria: item.criteria,
        };
      }
    }

    return null;
  }

  static async autoAssignDormitory(student) {
    const existingAssignment = await DormitoryAssignment.findOne({
      studentId: student._id,
      status: { $in: ['pending', 'confirmed'] },
    });

    if (existingAssignment) {
      throw new AppError('该学生已分配宿舍', 400);
    }

    const matchResult = await this.smartMatchDormitory(student);

    if (!matchResult) {
      throw new AppError('暂无可用床位，请稍后重试或联系管理员', 404);
    }

    const { dormitory, bed, matchScore, matchCriteria } = matchResult;

    const lockedBed = await Bed.findOneAndUpdate(
      {
        _id: bed._id,
        status: 'available',
      },
      {
        $set: {
          status: 'occupied',
          studentId: student._id,
          assignedAt: Date.now(),
        },
      },
      { new: true }
    );

    if (!lockedBed) {
      return this.autoAssignDormitory(student);
    }

    await Dormitory.findByIdAndUpdate(
      dormitory._id,
      { $inc: { occupiedCount: 1 } }
    );

    const assignment = await DormitoryAssignment.create({
      studentId: student._id,
      bedId: bed._id,
      dormitoryId: dormitory._id,
      buildingId: dormitory.buildingId,
      assignmentType: 'auto_match',
      matchScore,
      matchCriteria,
      status: 'confirmed',
      confirmedAt: Date.now(),
    });

    const building = await Building.findById(dormitory.buildingId);

    await NotificationService.sendToStudent(
      student._id,
      'dorm_assignment',
      '宿舍分配成功',
      `您已被分配到${building.name}${dormitory.roomNumber}房间${bed.bedNumber}床位`,
      assignment._id,
      'DormitoryAssignment'
    );

    return assignment;
  }

  static async getAvailableDormitories(student) {
    const { gender } = student.studentInfo;

    const buildings = await Building.find({
      $or: [{ gender: gender }, { gender: 'mixed' }],
    });

    const buildingIds = buildings.map((b) => b._id);

    const dormitories = await Dormitory.find({
      buildingId: { $in: buildingIds },
      occupiedCount: { $lt: 4 },
      selectionLocked: false,
    }).populate('buildingId');

    const result = [];
    for (const dorm of dormitories) {
      const beds = await Bed.find({
        dormitoryId: dorm._id,
        status: 'available',
      });

      if (beds.length > 0) {
        result.push({
          dormitory: dorm,
          availableBeds: beds,
        });
      }
    }

    return result;
  }

  static async selectBed(student, bedId) {
    const existingAssignment = await DormitoryAssignment.findOne({
      studentId: student._id,
      status: { $in: ['pending', 'confirmed'] },
    });

    if (existingAssignment) {
      throw new AppError('您已分配宿舍，不能重复选择', 400);
    }

    const bed = await Bed.findById(bedId).populate('dormitoryId').populate('buildingId');

    if (!bed) {
      throw new AppError('床位不存在', 404);
    }

    const building = bed.buildingId;
    if (building.gender !== student.studentInfo.gender && building.gender !== 'mixed') {
      throw new AppError('该楼栋性别不匹配', 400);
    }

    const lockedBed = await Bed.findOneAndUpdate(
      {
        _id: bedId,
        status: 'available',
      },
      {
        $set: {
          status: 'occupied',
          studentId: student._id,
          assignedAt: Date.now(),
        },
      },
      { new: true }
    );

    if (!lockedBed) {
      const recommendations = await this.getAvailableBedsRecommendation(student, 5);
      return {
        success: false,
        message: '该床位已被他人抢先选择，请选择其他床位',
        recommendations,
      };
    }

    await Dormitory.findByIdAndUpdate(
      bed.dormitoryId,
      { $inc: { occupiedCount: 1 } }
    );

    const assignment = await DormitoryAssignment.create({
      studentId: student._id,
      bedId: bed._id,
      dormitoryId: bed.dormitoryId,
      buildingId: bed.buildingId,
      assignmentType: 'manual_select',
      status: 'confirmed',
      confirmedAt: Date.now(),
    });

    await NotificationService.sendToStudent(
      student._id,
      'dorm_assignment',
      '选房成功',
      `您已成功选择${building.name}${bed.dormitoryId.roomNumber}房间${bed.bedNumber}床位`,
      assignment._id,
      'DormitoryAssignment'
    );

    return {
      success: true,
      assignment,
    };
  }

  static async getAvailableBedsRecommendation(student, limit = 5) {
    const { gender } = student.studentInfo;

    const buildings = await Building.find({
      $or: [{ gender: gender }, { gender: 'mixed' }],
    });
    const buildingIds = buildings.map((b) => b._id);

    const availableBeds = await Bed.aggregate([
      {
        $match: {
          buildingId: { $in: buildingIds },
          status: 'available',
        },
      },
      {
        $lookup: {
          from: 'dormitories',
          localField: 'dormitoryId',
          foreignField: '_id',
          as: 'dormitory',
        },
      },
      {
        $unwind: '$dormitory',
      },
      {
        $lookup: {
          from: 'buildings',
          localField: 'buildingId',
          foreignField: '_id',
          as: 'building',
        },
      },
      {
        $unwind: '$building',
      },
      {
        $match: {
          'dormitory.selectionLocked': false,
        },
      },
      {
        $sort: {
          'dormitory.occupiedCount': 1,
          'dormitory.comprehensiveScore': -1,
        },
      },
      {
        $limit: limit,
      },
      {
        $project: {
          _id: 1,
          bedNumber: 1,
          'dormitory._id': 1,
          'dormitory.roomNumber': 1,
          'dormitory.floor': 1,
          'dormitory.comprehensiveScore': 1,
          'dormitory.occupiedCount': 1,
          'building._id': 1,
          'building.name': 1,
        },
      },
    ]);

    return availableBeds;
  }

  static async getRecommendations(student) {
    const matchResult = await this.smartMatchDormitory(student);
    const available = await this.getAvailableDormitories(student);

    return {
      recommended: matchResult
        ? {
            dormitory: matchResult.dormitory,
            bed: matchResult.bed,
            score: matchResult.matchScore,
          }
        : null,
      alternatives: available.slice(0, 5),
    };
  }

  static async getMyAssignment(studentId) {
    let assignment = await DormitoryAssignment.findOne({
      studentId,
      status: { $in: ['pending', 'confirmed'] },
    })
      .populate('bedId')
      .populate('dormitoryId')
      .populate('buildingId');

    if (!assignment) {
      assignment = await DormitoryAssignment.findOne({
        studentId,
        status: 'moved_out',
      })
        .sort({ movedOutAt: -1 })
        .populate('bedId')
        .populate('dormitoryId')
        .populate('buildingId');

      if (assignment) {
        const plain = assignment.toObject();
        plain.status = 'moved_out';
        plain.isCheckedOut = true;
        return plain;
      }
      return null;
    }

    return assignment;
  }

  static async getAssignmentHistory(studentId) {
    return await DormitoryAssignment.find({
      studentId,
    })
      .sort({ createdAt: -1 })
      .populate('bedId')
      .populate('dormitoryId')
      .populate('buildingId');
  }

  static async createTransferRequest(student, data) {
    const currentAssignment = await DormitoryAssignment.findOne({
      studentId: student._id,
      status: 'confirmed',
    });

    if (!currentAssignment) {
      throw new AppError('您当前没有入住记录，无法申请调宿', 400);
    }

    const pendingRequest = await TransferRequest.findOne({
      studentId: student._id,
      status: 'pending',
    });

    if (pendingRequest) {
      throw new AppError('您已有待审核的调宿申请，请先处理', 400);
    }

    const request = await TransferRequest.create({
      studentId: student._id,
      currentAssignmentId: currentAssignment._id,
      currentBedId: currentAssignment.bedId,
      currentDormitoryId: currentAssignment.dormitoryId,
      currentBuildingId: currentAssignment.buildingId,
      reason: data.reason,
      preferredBuildingId: data.preferredBuildingId,
      preferredDormitoryId: data.preferredDormitoryId,
      preferredBedId: data.preferredBedId,
      additionalNotes: data.additionalNotes,
      status: 'pending',
    });

    const building = await Building.findById(currentAssignment.buildingId);
    if (building && building.managerId) {
      await NotificationService.sendToDormManager(
        building.managerId,
        'dorm_change',
        '新调宿申请',
        `${student.realName} 申请调宿，请及时审核`,
        request._id,
        'TransferRequest'
      );
    }

    if (student.studentInfo && student.studentInfo.counselorId) {
      await NotificationService.sendToCounselor(
        student.studentInfo.counselorId,
        'dorm_change',
        '新调宿申请',
        `${student.realName} 申请调宿，请及时审核`,
        request._id,
        'TransferRequest'
      );
    }

    return await TransferRequest.findById(request._id)
      .populate('currentBedId')
      .populate('currentDormitoryId')
      .populate('currentBuildingId', 'name')
      .populate('preferredBuildingId', 'name')
      .populate('preferredDormitoryId', 'roomNumber')
      .populate('preferredBedId', 'bedNumber');
  }

  static async getTransferRequests(studentId, role, status) {
    let query = {};

    if (role === 'student') {
      query.studentId = studentId;
    } else if (role === 'dorm_manager') {
    }

    if (status) {
      query.status = status;
    }

    return await TransferRequest.find(query)
      .sort({ createdAt: -1 })
      .populate('studentId', 'realName phone studentId')
      .populate('currentBedId', 'bedNumber')
      .populate('currentDormitoryId', 'roomNumber')
      .populate('currentBuildingId', 'name')
      .populate('targetBedId', 'bedNumber')
      .populate('targetDormitoryId', 'roomNumber')
      .populate('targetBuildingId', 'name')
      .populate('reviewedBy', 'realName');
  }

  static async reviewTransferRequest(reviewer, requestId, action, data = {}) {
    const request = await TransferRequest.findById(requestId)
      .populate('studentId')
      .populate('currentDormitoryId');

    if (!request) {
      throw new AppError('调宿申请不存在', 404);
    }

    if (request.status !== 'pending') {
      throw new AppError('该申请已处理', 400);
    }

    if (action === 'reject') {
      await TransferRequest.findByIdAndUpdate(requestId, {
        status: 'rejected',
        reviewedBy: reviewer._id,
        reviewedAt: Date.now(),
        reviewNotes: data.reviewNotes,
      });

      await NotificationService.sendToStudent(
        request.studentId._id,
        'dorm_change',
        '调宿申请被拒绝',
        `您的调宿申请已被拒绝，原因：${data.reviewNotes || '不符合调宿条件'}`,
        request._id,
        'TransferRequest'
      );

      return await TransferRequest.findById(requestId);
    }

    if (action === 'approve') {
      let targetBedId = data.targetBedId || request.preferredBedId;

      if (!targetBedId) {
        const recommendations = await this.getAvailableBedsRecommendation(request.studentId, 3);
        if (recommendations.length > 0) {
          targetBedId = recommendations[0]._id;
        } else {
          throw new AppError('暂无可用床位，请稍后再试', 400);
        }
      }

      const targetBed = await Bed.findById(targetBedId).populate('dormitoryId').populate('buildingId');
      if (!targetBed || targetBed.status !== 'available') {
        throw new AppError('目标床位不可用', 400);
      }

      const lockedBed = await Bed.findOneAndUpdate(
        { _id: targetBedId, status: 'available' },
        {
          $set: {
            status: 'occupied',
            studentId: request.studentId._id,
            assignedAt: Date.now(),
          },
        },
        { new: true }
      );

      if (!lockedBed) {
        throw new AppError('目标床位已被占用，请选择其他床位', 400);
      }

      await Bed.findByIdAndUpdate(request.currentBedId, {
        status: 'available',
        studentId: null,
        assignedAt: null,
      });

      await Dormitory.findByIdAndUpdate(request.currentDormitoryId, {
        $inc: { occupiedCount: -1 },
      });

      await Dormitory.findByIdAndUpdate(targetBed.dormitoryId, {
        $inc: { occupiedCount: 1 },
      });

      await DormitoryAssignment.findByIdAndUpdate(request.currentAssignmentId, {
        status: 'moved_out',
        movedOutAt: Date.now(),
      });

      const newAssignment = await DormitoryAssignment.create({
        studentId: request.studentId._id,
        bedId: targetBedId,
        dormitoryId: targetBed.dormitoryId,
        buildingId: targetBed.buildingId,
        assignmentType: 'transfer',
        previousAssignmentId: request.currentAssignmentId,
        status: 'confirmed',
        confirmedAt: Date.now(),
      });

      await TransferRequest.findByIdAndUpdate(requestId, {
        status: 'completed',
        reviewedBy: reviewer._id,
        reviewedAt: Date.now(),
        reviewNotes: data.reviewNotes,
        targetBedId,
        targetDormitoryId: targetBed.dormitoryId,
        targetBuildingId: targetBed.buildingId,
        newAssignmentId: newAssignment._id,
        completedAt: Date.now(),
      });

      await NotificationService.sendToStudent(
        request.studentId._id,
        'dorm_change',
        '调宿申请已通过',
        `您已成功调至${targetBed.buildingId.name}${targetBed.dormitoryId.roomNumber}房间${targetBed.bedNumber}床位`,
        newAssignment._id,
        'DormitoryAssignment'
      );

      return await TransferRequest.findById(requestId)
        .populate('targetBedId')
        .populate('targetDormitoryId')
        .populate('targetBuildingId');
    }

    throw new AppError('无效的操作类型', 400);
  }

  static async checkOutDormitory(student, reason) {
    const currentAssignment = await DormitoryAssignment.findOne({
      studentId: student._id,
      status: 'confirmed',
    }).populate('dormitoryId').populate('buildingId');

    if (!currentAssignment) {
      throw new AppError('您当前没有入住记录', 400);
    }

    await Bed.findByIdAndUpdate(currentAssignment.bedId, {
      status: 'available',
      studentId: null,
      assignedAt: null,
    });

    await Dormitory.findByIdAndUpdate(currentAssignment.dormitoryId, {
      $inc: { occupiedCount: -1 },
    });

    await DormitoryAssignment.findByIdAndUpdate(currentAssignment._id, {
      status: 'moved_out',
      movedOutAt: Date.now(),
      assignmentType: 'check_out',
    });

    await NotificationService.sendToStudent(
      student._id,
      'dorm_change',
      '退宿成功',
      `您已成功办理退宿，感谢您的入住`,
      currentAssignment._id,
      'DormitoryAssignment'
    );

    return {
      success: true,
      message: '退宿成功',
      previousAssignment: currentAssignment,
    };
  }

  static async cancelTransferRequest(student, requestId) {
    const request = await TransferRequest.findById(requestId);

    if (!request) {
      throw new AppError('调宿申请不存在', 404);
    }

    if (request.studentId.toString() !== student._id.toString()) {
      throw new AppError('无权取消此申请', 403);
    }

    if (request.status !== 'pending') {
      throw new AppError('该申请已处理，无法取消', 400);
    }

    await TransferRequest.findByIdAndUpdate(requestId, {
      status: 'cancelled',
    });

    return await TransferRequest.findById(requestId);
  }
}

module.exports = DormitoryService;
