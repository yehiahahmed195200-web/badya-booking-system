BEGIN TRY

BEGIN TRAN;

-- CreateSchema
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = N'dbo') EXEC sp_executesql N'CREATE SCHEMA [dbo];';

-- CreateTable
CREATE TABLE [dbo].[audit_logs] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [action] VARCHAR(255) NOT NULL,
    [created_at] DATETIME2 NOT NULL,
    [details] TEXT,
    [ip_address] VARCHAR(255),
    [user_agent] VARCHAR(255),
    [admin_id] BIGINT NOT NULL,
    [ipAddress] VARCHAR(255),
    [userAgent] VARCHAR(255),
    CONSTRAINT [audit_logs_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[bookings] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [attendance_status] NVARCHAR(1000),
    [checked_in_at] DATETIME2,
    [checked_out_at] DATETIME2,
    [conflict_id] VARCHAR(255),
    [created_at] DATETIME2 NOT NULL,
    [distance_from_facility] FLOAT(53),
    [end_time] DATETIME2 NOT NULL,
    [participants] INT NOT NULL,
    [start_time] DATETIME2 NOT NULL,
    [status] NVARCHAR(1000) NOT NULL,
    [student_latitude] FLOAT(53),
    [student_longitude] FLOAT(53),
    [verified_by] VARCHAR(255),
    [facility_id] BIGINT NOT NULL,
    [user_id] BIGINT NOT NULL,
    [scanned_id_data] VARCHAR(255),
    [attendanceStatus] NVARCHAR(1000),
    [checkedInAt] DATETIME2,
    [checkedOutAt] DATETIME2,
    [conflictId] VARCHAR(255),
    [distanceFromFacility] FLOAT(53),
    [scannedIdData] VARCHAR(255),
    [studentLatitude] FLOAT(53),
    [studentLongitude] FLOAT(53),
    [verifiedBy] VARCHAR(255),
    CONSTRAINT [bookings_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[facilities] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [active] BIT NOT NULL,
    [category] VARCHAR(255) NOT NULL,
    [close_time] VARCHAR(255),
    [default_slot_mins] INT,
    [geofencing_radius] FLOAT(53),
    [latitude] FLOAT(53),
    [longitude] FLOAT(53),
    [max_participants] INT,
    [min_participants] INT,
    [name] VARCHAR(255) NOT NULL,
    [open_time] VARCHAR(255),
    [sports] TEXT,
    [status] VARCHAR(255),
    [status_reason] TEXT,
    [closeTime] VARCHAR(255),
    [defaultSlotMins] INT,
    [geofencingRadius] FLOAT(53),
    [maxParticipants] INT,
    [minParticipants] INT,
    [openTime] VARCHAR(255),
    [statusReason] TEXT,
    CONSTRAINT [facilities_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [UK6tm0w2xajnx3l566muxq8apmq] UNIQUE NONCLUSTERED ([name])
);

-- CreateTable
CREATE TABLE [dbo].[medical_records] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [created_at] DATETIME2 NOT NULL,
    [description] TEXT,
    [document_name] VARCHAR(255),
    [document_url] VARCHAR(512),
    [status] VARCHAR(255) NOT NULL,
    [submitted_by] VARCHAR(255),
    [user_id] BIGINT NOT NULL,
    [documentName] VARCHAR(255),
    [documentUrl] VARCHAR(512),
    [submittedBy] VARCHAR(255),
    CONSTRAINT [medical_records_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[notifications] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [created_at] DATETIME2 NOT NULL,
    [message] TEXT NOT NULL,
    [is_read] BIT NOT NULL,
    [title] VARCHAR(255) NOT NULL,
    [type] NVARCHAR(1000) NOT NULL,
    [user_id] BIGINT NOT NULL,
    CONSTRAINT [notifications_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[system_rules] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [advance_booking_window_days] INT,
    [allow_back_to_back_bookings] BIT,
    [auto_ban_warning_threshold] INT,
    [global_email_notifications_enabled] BIT,
    [max_booking_duration_mins] INT,
    [max_bookings_per_user_per_day] INT,
    [min_booking_duration_mins] INT,
    [priority_booking_enabled] BIT,
    [priority_early_access_hours] INT,
    [priority_score_threshold] INT,
    [advanceBookingWindowDays] INT,
    [allowBackToBackBookings] BIT,
    [autoBanWarningThreshold] INT,
    [globalEmailNotificationsEnabled] BIT,
    [maxBookingDurationMins] INT,
    [maxBookingsPerUserPerDay] INT,
    [minBookingDurationMins] INT,
    [priorityBookingEnabled] BIT,
    [priorityEarlyAccessHours] INT,
    [priorityScoreThreshold] INT,
    CONSTRAINT [system_rules_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[users] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [active_bookings] INT,
    [banned] BIT NOT NULL,
    [earned_points] INT,
    [email] VARCHAR(255) NOT NULL,
    [email_notifications] BIT,
    [full_name] VARCHAR(255),
    [push_notifications] BIT,
    [role] NVARCHAR(1000) NOT NULL,
    [warnings] INT NOT NULL,
    [credits] INT NOT NULL,
    [barcode] VARCHAR(255),
    [student_id] VARCHAR(255),
    [activeBookings] INT,
    [earnedPoints] INT,
    [emailNotifications] BIT,
    [fullName] VARCHAR(255),
    [pushNotifications] BIT,
    [studentId] VARCHAR(255),
    [skillLevel] VARCHAR(50),
    [deviceId] VARCHAR(255),
    [device_id] VARCHAR(255),
    [otpCode] VARCHAR(255),
    [otp_code] VARCHAR(255),
    [otpExpiry] DATETIME2,
    [otp_expiry] DATETIME2,
    [pendingDeviceId] VARCHAR(255),
    [pending_device_id] VARCHAR(255),
    [deviceChangeStatus] VARCHAR(50),
    [device_change_status] VARCHAR(50),
    [deviceChangeRequestedAt] DATETIME2,
    [device_change_requested_at] DATETIME2,
    CONSTRAINT [users_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [UK6dotkott2kjsp8vw4d0m25fb7] UNIQUE NONCLUSTERED ([email]),
    CONSTRAINT [UKi095je3dnvjnhvteqhmok2gc6] UNIQUE NONCLUSTERED ([barcode]),
    CONSTRAINT [UKqh3otyipv2k9hqte4a1abcyhq] UNIQUE NONCLUSTERED ([student_id]),
    CONSTRAINT [UKolxe15b9ax5ojsnv4ig6g6n7] UNIQUE NONCLUSTERED ([studentId])
);

-- CreateTable
CREATE TABLE [dbo].[waitlist_entries] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [created_at] DATETIME2,
    [desired_start_time] DATETIME2,
    [participants] INT NOT NULL,
    [facility_id] BIGINT NOT NULL,
    [user_id] BIGINT NOT NULL,
    [createdAt] DATETIME2,
    [desiredStartTime] DATETIME2,
    CONSTRAINT [waitlist_entries_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[user] (
    [id] NVARCHAR(1000) NOT NULL,
    [studentId] NVARCHAR(1000) NOT NULL,
    [phone] NVARCHAR(1000),
    [fullName] NVARCHAR(1000),
    [email] NVARCHAR(1000),
    [college] NVARCHAR(1000),
    [barcode] NVARCHAR(1000),
    [passwordHash] NVARCHAR(1000) NOT NULL,
    [role] NVARCHAR(1000) NOT NULL CONSTRAINT [user_role_df] DEFAULT 'STUDENT',
    [managedFacilityId] NVARCHAR(1000),
    [points] INT NOT NULL CONSTRAINT [user_points_df] DEFAULT 0,
    [warnings] INT NOT NULL CONSTRAINT [user_warnings_df] DEFAULT 0,
    [isBanned] BIT NOT NULL CONSTRAINT [user_isBanned_df] DEFAULT 0,
    [banReason] NVARCHAR(1000),
    [bannedAt] DATETIME2,
    [banExpiresAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [user_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [skillLevel] NVARCHAR(1000) NOT NULL CONSTRAINT [user_skillLevel_df] DEFAULT 'Intermediate',
    CONSTRAINT [user_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [User_studentId_key] UNIQUE NONCLUSTERED ([studentId]),
    CONSTRAINT [User_phone_key] UNIQUE NONCLUSTERED ([phone]),
    CONSTRAINT [User_email_key] UNIQUE NONCLUSTERED ([email]),
    CONSTRAINT [User_barcode_key] UNIQUE NONCLUSTERED ([barcode])
);

-- CreateTable
CREATE TABLE [dbo].[sport] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [icon] NVARCHAR(1000),
    [description] NVARCHAR(1000),
    [minParticipants] INT NOT NULL CONSTRAINT [sport_minParticipants_df] DEFAULT 1,
    [maxParticipants] INT NOT NULL CONSTRAINT [sport_maxParticipants_df] DEFAULT 20,
    [durationOptions] NVARCHAR(1000) NOT NULL CONSTRAINT [sport_durationOptions_df] DEFAULT '30,60,90',
    [requiresCoach] BIT NOT NULL CONSTRAINT [sport_requiresCoach_df] DEFAULT 0,
    [idealParticipants] INT NOT NULL CONSTRAINT [sport_idealParticipants_df] DEFAULT 10,
    CONSTRAINT [sport_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Sport_name_key] UNIQUE NONCLUSTERED ([name])
);

-- CreateTable
CREATE TABLE [dbo].[facility] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [sportId] NVARCHAR(1000),
    [sports] TEXT,
    [category] NVARCHAR(1000) NOT NULL,
    [defaultSlotMins] INT NOT NULL CONSTRAINT [facility_defaultSlotMins_df] DEFAULT 60,
    [openTime] NVARCHAR(1000) NOT NULL,
    [closeTime] NVARCHAR(1000) NOT NULL,
    [minParticipants] INT NOT NULL CONSTRAINT [facility_minParticipants_df] DEFAULT 1,
    [maxParticipants] INT NOT NULL CONSTRAINT [facility_maxParticipants_df] DEFAULT 20,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [facility_status_df] DEFAULT 'OPEN',
    [statusReason] NVARCHAR(1000),
    [isActive] BIT NOT NULL CONSTRAINT [facility_isActive_df] DEFAULT 1,
    [feedbackEnabled] BIT NOT NULL CONSTRAINT [facility_feedbackEnabled_df] DEFAULT 1,
    [latitude] FLOAT(53),
    [longitude] FLOAT(53),
    [geofencingRadius] FLOAT(53),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [facility_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [facility_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Facility_name_key] UNIQUE NONCLUSTERED ([name])
);

-- CreateTable
CREATE TABLE [dbo].[conflict] (
    [id] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000) NOT NULL,
    [resolved] BIT NOT NULL CONSTRAINT [conflict_resolved_df] DEFAULT 0,
    [resolvedAt] DATETIME2,
    [resolvedBy] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [conflict_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [conflict_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[booking] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [facilityId] NVARCHAR(1000) NOT NULL,
    [startTime] DATETIME2 NOT NULL,
    [endTime] DATETIME2 NOT NULL,
    [participants] INT NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [booking_status_df] DEFAULT 'PENDING',
    [requiresApproval] BIT NOT NULL CONSTRAINT [booking_requiresApproval_df] DEFAULT 0,
    [approverRole] NVARCHAR(1000),
    [conflictId] NVARCHAR(1000),
    [rejectionReason] NVARCHAR(1000),
    [reminderSent] BIT NOT NULL CONSTRAINT [booking_reminderSent_df] DEFAULT 0,
    [termsAccepted] BIT NOT NULL CONSTRAINT [booking_termsAccepted_df] DEFAULT 0,
    [buddyIds] NVARCHAR(1000) NOT NULL CONSTRAINT [booking_buddyIds_df] DEFAULT '[]',
    [attendanceStatus] NVARCHAR(1000) NOT NULL CONSTRAINT [booking_attendanceStatus_df] DEFAULT 'NOT_CHECKED_IN',
    [checkedInAt] DATETIME2,
    [checkedOutAt] DATETIME2,
    [studentLatitude] FLOAT(53),
    [studentLongitude] FLOAT(53),
    [distanceFromFacility] FLOAT(53),
    [verifiedBy] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [booking_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [sportId] NVARCHAR(1000),
    CONSTRAINT [booking_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[feedback] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [rating] INT NOT NULL,
    [bookingId] NVARCHAR(1000),
    [booking_id] BIGINT,
    [comment] NVARCHAR(1000),
    [createdAt] DATETIME2 CONSTRAINT [feedback_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [facilityId] NVARCHAR(1000),
    [isAnonymous] BIT NOT NULL CONSTRAINT [feedback_isAnonymous_df] DEFAULT 0,
    [userId] NVARCHAR(1000),
    [content] TEXT,
    [created_at] DATETIME2,
    [type] NVARCHAR(1000),
    [user_id] BIGINT,
    [facility_id] BIGINT,
    CONSTRAINT [feedback_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[notification] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [message] NVARCHAR(1000) NOT NULL,
    [channel] NVARCHAR(1000) NOT NULL CONSTRAINT [notification_channel_df] DEFAULT 'EMAIL',
    [read] BIT NOT NULL CONSTRAINT [notification_read_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [notification_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [notification_status_df] DEFAULT 'QUEUED',
    [failureReason] NVARCHAR(1000),
    [failedAt] DATETIME2,
    [sentAt] DATETIME2,
    [readAt] DATETIME2,
    [nextRetryAt] DATETIME2,
    [expiresAt] DATETIME2,
    [attemptCount] INT NOT NULL CONSTRAINT [notification_attemptCount_df] DEFAULT 0,
    [maxAttempts] INT NOT NULL CONSTRAINT [notification_maxAttempts_df] DEFAULT 3,
    [priority] NVARCHAR(1000) NOT NULL CONSTRAINT [notification_priority_df] DEFAULT 'NORMAL',
    [type] NVARCHAR(1000) NOT NULL CONSTRAINT [notification_type_df] DEFAULT 'SYSTEM',
    [actionUrl] NVARCHAR(1000),
    [payload] NVARCHAR(max),
    [dedupeKey] NVARCHAR(1000),
    CONSTRAINT [notification_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[systemrule] (
    [id] NVARCHAR(1000) NOT NULL,
    [maxBookingsPerDay] INT NOT NULL CONSTRAINT [systemrule_maxBookingsPerDay_df] DEFAULT 1,
    [autoBanThreshold] INT NOT NULL CONSTRAINT [systemrule_autoBanThreshold_df] DEFAULT 3,
    [advanceBookingWindow] INT NOT NULL CONSTRAINT [systemrule_advanceBookingWindow_df] DEFAULT 7,
    [minimumNoticeTime] INT NOT NULL CONSTRAINT [systemrule_minimumNoticeTime_df] DEFAULT 24,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [systemrule_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[reward] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000) NOT NULL,
    [pointsCost] INT NOT NULL,
    [rewardType] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [reward_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[userreward] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [rewardId] NVARCHAR(1000) NOT NULL,
    [redeemedAt] DATETIME2 NOT NULL CONSTRAINT [userreward_redeemedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [userreward_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[adminlog] (
    [id] NVARCHAR(1000) NOT NULL,
    [adminId] NVARCHAR(1000) NOT NULL,
    [action] NVARCHAR(1000) NOT NULL,
    [targetId] NVARCHAR(1000),
    [details] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [adminlog_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [adminlog_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[medicalrecord] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [documentUrl] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [isEncrypted] BIT NOT NULL CONSTRAINT [medicalrecord_isEncrypted_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [medicalrecord_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [medicalrecord_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[dailyusage] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [facilityId] NVARCHAR(1000) NOT NULL,
    [studentId] NVARCHAR(1000) NOT NULL CONSTRAINT [dailyusage_studentId_df] DEFAULT '',
    [studentName] NVARCHAR(1000) NOT NULL CONSTRAINT [dailyusage_studentName_df] DEFAULT '',
    [facilityName] NVARCHAR(1000) NOT NULL CONSTRAINT [dailyusage_facilityName_df] DEFAULT '',
    [date] NVARCHAR(1000) NOT NULL,
    [usedMins] INT NOT NULL CONSTRAINT [dailyusage_usedMins_df] DEFAULT 0,
    [remainingMins] INT NOT NULL CONSTRAINT [dailyusage_remainingMins_df] DEFAULT 60,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [dailyusage_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [DailyUsage_userId_facilityId_date_key] UNIQUE NONCLUSTERED ([userId],[facilityId],[date])
);

-- CreateTable
CREATE TABLE [dbo].[BookingParticipant] (
    [id] NVARCHAR(1000) NOT NULL,
    [bookingId] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [team] NVARCHAR(1000) NOT NULL CONSTRAINT [BookingParticipant_team_df] DEFAULT 'A',
    CONSTRAINT [BookingParticipant_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [BookingParticipant_bookingId_userId_key] UNIQUE NONCLUSTERED ([bookingId],[userId])
);

-- CreateTable
CREATE TABLE [dbo].[MatchmakingQueue] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [sportId] NVARCHAR(1000) NOT NULL,
    [facilityId] NVARCHAR(1000) NOT NULL,
    [date] NVARCHAR(1000) NOT NULL,
    [timeSlot] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [MatchmakingQueue_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [MatchmakingQueue_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [MatchmakingQueue_userId_sportId_date_timeSlot_key] UNIQUE NONCLUSTERED ([userId],[sportId],[date],[timeSlot])
);

-- CreateTable
CREATE TABLE [dbo].[fairness_config] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [primeTimeStartHour] INT NOT NULL CONSTRAINT [fairness_config_primeTimeStartHour_df] DEFAULT 17,
    [primeTimeEndHour] INT NOT NULL CONSTRAINT [fairness_config_primeTimeEndHour_df] DEFAULT 21,
    [basketballQuotaPercent] FLOAT(53) NOT NULL CONSTRAINT [fairness_config_basketballQuotaPercent_df] DEFAULT 60.0,
    [volleyballQuotaPercent] FLOAT(53) NOT NULL CONSTRAINT [fairness_config_volleyballQuotaPercent_df] DEFAULT 40.0,
    [cooldownPeriodHours] INT NOT NULL CONSTRAINT [fairness_config_cooldownPeriodHours_df] DEFAULT 24,
    [maxWeeklyReservationsPerUser] INT NOT NULL CONSTRAINT [fairness_config_maxWeeklyReservationsPerUser_df] DEFAULT 3,
    [consecutiveSlotLimit] INT NOT NULL CONSTRAINT [fairness_config_consecutiveSlotLimit_df] DEFAULT 2,
    [teamOverlapThresholdPercent] FLOAT(53) NOT NULL CONSTRAINT [fairness_config_teamOverlapThresholdPercent_df] DEFAULT 50.0,
    [playerWeightCoeff] FLOAT(53) NOT NULL CONSTRAINT [fairness_config_playerWeightCoeff_df] DEFAULT 0.4,
    [unusedHoursWeightCoeff] FLOAT(53) NOT NULL CONSTRAINT [fairness_config_unusedHoursWeightCoeff_df] DEFAULT 0.3,
    [primeTimeDisadvantageCoeff] FLOAT(53) NOT NULL CONSTRAINT [fairness_config_primeTimeDisadvantageCoeff_df] DEFAULT 0.3,
    CONSTRAINT [fairness_config_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[weekly_sport_stats] (
    [id] NVARCHAR(1000) NOT NULL,
    [year] INT NOT NULL,
    [weekNumber] INT NOT NULL,
    [sportId] NVARCHAR(1000) NOT NULL,
    [bookedHours] FLOAT(53) NOT NULL CONSTRAINT [weekly_sport_stats_bookedHours_df] DEFAULT 0.0,
    [activePlayersCount] INT NOT NULL CONSTRAINT [weekly_sport_stats_activePlayersCount_df] DEFAULT 0,
    [primeTimeHoursUsed] FLOAT(53) NOT NULL CONSTRAINT [weekly_sport_stats_primeTimeHoursUsed_df] DEFAULT 0.0,
    [rejectedBookingsCount] INT NOT NULL CONSTRAINT [weekly_sport_stats_rejectedBookingsCount_df] DEFAULT 0,
    CONSTRAINT [weekly_sport_stats_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [weekly_sport_stats_year_weekNumber_sportId_key] UNIQUE NONCLUSTERED ([year],[weekNumber],[sportId])
);

-- CreateTable
CREATE TABLE [dbo].[violation] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [type] NVARCHAR(1000) NOT NULL,
    [severity] NVARCHAR(1000) NOT NULL CONSTRAINT [violation_severity_df] DEFAULT 'MINOR',
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [violation_status_df] DEFAULT 'OPEN',
    [description] NVARCHAR(1000),
    [bookingId] NVARCHAR(1000),
    [facilityId] NVARCHAR(1000),
    [evidenceUrl] NVARCHAR(1000),
    [reportedById] NVARCHAR(1000),
    [metadata] NVARCHAR(max),
    [dedupeKey] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [violation_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [resolvedAt] DATETIME2,
    CONSTRAINT [violation_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [violation_dedupeKey_key] UNIQUE NONCLUSTERED ([dedupeKey])
);

-- CreateTable
CREATE TABLE [dbo].[penalty] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [violationId] NVARCHAR(1000),
    [type] NVARCHAR(1000) NOT NULL,
    [amount] FLOAT(53),
    [currency] NVARCHAR(1000),
    [reason] NVARCHAR(1000),
    [startAt] DATETIME2,
    [endAt] DATETIME2,
    [metadata] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [penalty_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [penalty_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[user_restriction] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [type] NVARCHAR(1000) NOT NULL,
    [reason] NVARCHAR(1000),
    [startAt] DATETIME2 NOT NULL CONSTRAINT [user_restriction_startAt_df] DEFAULT CURRENT_TIMESTAMP,
    [endAt] DATETIME2,
    [createdById] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [user_restriction_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [user_restriction_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[audit_log] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000),
    [action] NVARCHAR(1000) NOT NULL,
    [entity] NVARCHAR(1000) NOT NULL,
    [entityId] NVARCHAR(1000),
    [description] NVARCHAR(1000),
    [oldValue] NVARCHAR(max),
    [newValue] NVARCHAR(max),
    [metadata] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [audit_log_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [audit_log_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[notification_preference] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [appEnabled] BIT NOT NULL CONSTRAINT [notification_preference_appEnabled_df] DEFAULT 1,
    [emailEnabled] BIT NOT NULL CONSTRAINT [notification_preference_emailEnabled_df] DEFAULT 1,
    [smsEnabled] BIT NOT NULL CONSTRAINT [notification_preference_smsEnabled_df] DEFAULT 0,
    [pushEnabled] BIT NOT NULL CONSTRAINT [notification_preference_pushEnabled_df] DEFAULT 0,
    [bookingEnabled] BIT NOT NULL CONSTRAINT [notification_preference_bookingEnabled_df] DEFAULT 1,
    [attendanceEnabled] BIT NOT NULL CONSTRAINT [notification_preference_attendanceEnabled_df] DEFAULT 1,
    [securityEnabled] BIT NOT NULL CONSTRAINT [notification_preference_securityEnabled_df] DEFAULT 1,
    [accountEnabled] BIT NOT NULL CONSTRAINT [notification_preference_accountEnabled_df] DEFAULT 1,
    [rewardEnabled] BIT NOT NULL CONSTRAINT [notification_preference_rewardEnabled_df] DEFAULT 1,
    [quietHoursStart] INT,
    [quietHoursEnd] INT,
    [timezone] NVARCHAR(1000) CONSTRAINT [notification_preference_timezone_df] DEFAULT 'UTC',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [notification_preference_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [notification_preference_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [notification_preference_userId_key] UNIQUE NONCLUSTERED ([userId])
);

-- CreateTable
CREATE TABLE [dbo].[notification_delivery_log] (
    [id] NVARCHAR(1000) NOT NULL,
    [notificationId] NVARCHAR(1000) NOT NULL,
    [channel] NVARCHAR(1000) NOT NULL,
    [attempt] INT NOT NULL,
    [status] NVARCHAR(1000) NOT NULL,
    [provider] NVARCHAR(1000),
    [providerId] NVARCHAR(1000),
    [errorCode] NVARCHAR(1000),
    [errorMessage] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [notification_delivery_log_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [notification_delivery_log_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[system_setting] (
    [id] NVARCHAR(1000) NOT NULL,
    [key] NVARCHAR(1000) NOT NULL,
    [value] NVARCHAR(max) NOT NULL,
    [type] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [isPublic] BIT NOT NULL CONSTRAINT [system_setting_isPublic_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [system_setting_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [system_setting_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [system_setting_key_key] UNIQUE NONCLUSTERED ([key])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [idx_action] ON [dbo].[audit_logs]([action]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [idx_admin_id] ON [dbo].[audit_logs]([admin_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [idx_created_at] ON [dbo].[audit_logs]([created_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [FKeyog2oic85xg7hsu2je2lx3s6] ON [dbo].[bookings]([user_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [FKovcktajgjh8wo5wrx0e2j2jpd] ON [dbo].[bookings]([facility_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [FKdd9qwwn228b1yaci52j69dkp4] ON [dbo].[medical_records]([user_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [FK9y21adhxn0ayjhfocscqox7bh] ON [dbo].[notifications]([user_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [FK5668m6tlre17gx47jbh3tk351] ON [dbo].[waitlist_entries]([facility_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [FKdpgl4h9wd7kabg6dk86wdvjqy] ON [dbo].[waitlist_entries]([user_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [User_managedFacilityId_fkey] ON [dbo].[user]([managedFacilityId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Facility_sportId_fkey] ON [dbo].[facility]([sportId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Booking_conflictId_fkey] ON [dbo].[booking]([conflictId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Booking_facilityId_startTime_endTime_idx] ON [dbo].[booking]([facilityId], [startTime], [endTime]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Booking_userId_fkey] ON [dbo].[booking]([userId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [FK9c5da9vnu0n9n8ddnvq234ruv] ON [dbo].[feedback]([facility_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [FKpwwmhguqianghvi1wohmtsm8l] ON [dbo].[feedback]([user_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Feedback_facilityId_createdAt_idx] ON [dbo].[feedback]([facilityId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Notification_userId_createdAt_idx] ON [dbo].[notification]([userId], [createdAt]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

