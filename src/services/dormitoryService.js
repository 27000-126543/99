const Bed = require('../models/Bed');
const Dormitory = require('../models/Dormitory');
const Building = require('../models/Building');
const DormitoryAssignment = require('../models/DormitoryAssignment');
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

    const session = await Bed.startSession();
    session.startTransaction();

    try {
      await Bed.findByIdAndUpdate(
        bed._id,
        {
          status: 'occupied',
          studentId: student._id,
          assignedAt: Date.now(),
        },
        { session }
      );

      await Dormitory.findByIdAndUpdate(
        dormitory._id,
        { $inc: { occupiedCount: 1 } },
        { session }
      );

      const assignment = await DormitoryAssignment.create(
        [
          {
            studentId: student._id,
            bedId: bed._id,
            dormitoryId: dormitory._id,
            buildingId: dormitory.buildingId,
            assignmentType: 'auto_match',
            matchScore,
            matchCriteria,
            status: 'confirmed',
            confirmedAt: Date.now(),
          },
        ],
        { session }
      );

      await session.commitTransaction();

      await NotificationService.sendToStudent(
        student._id,
        'dorm_assignment',
        '宿舍分配成功',
        `您已被分配到${dormitory.buildingId.name}${dormitory.roomNumber}房间${bed.bedNumber}床位`,
        assignment[0]._id,
        'DormitoryAssignment'
      );

      return assignment[0];
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
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

    const bed = await Bed.findById(bedId).populate('dormitoryId');

    if (!bed) {
      throw new AppError('床位不存在', 404);
    }

    if (bed.status !== 'available') {
      const recommendations = await this.getRecommendations(student);
      return {
        success: false,
        message: '该床位已被占用',
        recommendations,
      };
    }

    const building = await Building.findById(bed.buildingId);
    if (building.gender !== student.studentInfo.gender && building.gender !== 'mixed') {
      throw new AppError('该楼栋性别不匹配', 400);
    }

    const session = await Bed.startSession();
    session.startTransaction();

    try {
      const lockedBed = await Bed.findByIdAndUpdate(
        bedId,
        { status: 'occupied', studentId: student._id, assignedAt: Date.now() },
        { session, new: true }
      );

      if (!lockedBed || lockedBed.status !== 'occupied') {
        await session.abortTransaction();
        const recommendations = await this.getRecommendations(student);
        return {
          success: false,
          message: '选房冲突，请选择其他床位',
          recommendations,
        };
      }

      await Dormitory.findByIdAndUpdate(
        bed.dormitoryId,
        { $inc: { occupiedCount: 1 } },
        { session }
      );

      const assignment = await DormitoryAssignment.create(
        [
          {
            studentId: student._id,
            bedId: bed._id,
            dormitoryId: bed.dormitoryId,
            buildingId: bed.buildingId,
            assignmentType: 'manual_select',
            status: 'confirmed',
            confirmedAt: Date.now(),
          },
        ],
        { session }
      );

      await session.commitTransaction();

      await NotificationService.sendToStudent(
        student._id,
        'dorm_assignment',
        '选房成功',
        `您已成功选择${building.name}${bed.dormitoryId.roomNumber}房间${bed.bedNumber}床位`,
        assignment[0]._id,
        'DormitoryAssignment'
      );

      return {
        success: true,
        assignment: assignment[0],
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
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
    return await DormitoryAssignment.findOne({
      studentId,
      status: { $in: ['pending', 'confirmed'] },
    })
      .populate('bedId')
      .populate('dormitoryId')
      .populate('buildingId');
  }
}

module.exports = DormitoryService;
