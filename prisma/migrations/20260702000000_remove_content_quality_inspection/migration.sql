DELETE FROM "NotificationPreference"
WHERE "messageType" = 'CONTENT_QUALITY';

DELETE FROM "Message"
WHERE "type" = 'CONTENT_QUALITY';

DROP TABLE IF EXISTS "QualityIssueIgnore";
