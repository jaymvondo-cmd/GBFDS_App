const sequelize = require("../config/config");
const { DataTypes } = require("sequelize");

// Schema as specified — no business logic here, just the table shape.
const DetectionRule = sequelize.define(
    "DetectionRule",
    {
        rule_id: {
            type: DataTypes.STRING(50),
            primaryKey: true,
        },
        rule_name: {
            type: DataTypes.STRING(100),
        },
        description: {
            type: DataTypes.TEXT,
        },
        rule_type: {
            type: DataTypes.STRING(50),
        },
        condition_field: {
            type: DataTypes.STRING(50),
        },
        threshold: {
            type: DataTypes.DOUBLE,
        },
        weight: {
            type: DataTypes.DOUBLE,
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
        created_by: {
            type: DataTypes.STRING(50),
        },
        created_at: {
            type: DataTypes.DATE,
        },
    },
    {
        tableName: "detection_rules",
        timestamps: false,
    }
);

module.exports = DetectionRule;
