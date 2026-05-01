// models/Content.js - Content/Statistics Model
const mongoose = require('mongoose');

const contentSchema = new mongoose.Schema({
    // Statistics for hero section and about page
    statistics: {
        yearsOfExperience: {
            type: Number,
            default: 0
        },
        projectsCompleted: {
            type: Number,
            default: 0
        },
        satisfiedCustomers: {
            type: Number,
            default: 0
        },
        coverageAreas: {
            type: Number,
            default: 0
        }
    },
    // Site content
    siteName: {
        type: String,
        default: 'Linknet Fiber'
    },
    siteDescription: {
        type: String,
        default: 'Kenya\'s Most Reliable Fiber Network'
    },
    // Contact information
    contactEmail: {
        type: String,
        default: 'info@linknetfiber.com'
    },
    contactPhone: {
        type: String,
        default: '+254 708 860 451'
    },
    supportEmail: {
        type: String,
        default: 'support@linknetfiber.com'
    },
    whatsappNumber: {
        type: String,
        default: '+254708860451'
    },
    contactAddress: {
        type: String,
        default: 'Juja, Kiambu, Kenya'
    },
    // Social media
    socialMedia: {
        facebook: {
            type: String,
            default: 'https://facebook.com/linknetfiber'
        },
        twitter: {
            type: String,
            default: 'https://twitter.com/linknetfiber'
        },
        instagram: {
            type: String,
            default: 'https://instagram.com/linknetfiber'
        },
        linkedin: {
            type: String,
            default: 'https://linkedin.com/company/linknetfiber'
        },
        tiktok: {
            type: String,
            default: 'https://www.tiktok.com/@linknetfiber'
        }
    },
    // Business hours
    businessHours: {
        weekdays: {
            type: String,
            default: '8:00 AM - 6:00 PM'
        },
        saturday: {
            type: String,
            default: '9:00 AM - 4:00 PM'
        },
        sunday: {
            type: String,
            default: 'Closed'
        }
    },
    // Notifications settings
    notifications: {
        emailNotifications: {
            type: Boolean,
            default: true
        },
        smsNotifications: {
            type: Boolean,
            default: false
        },
        newRequestAlert: {
            type: Boolean,
            default: true
        },
        monthlyReports: {
            type: Boolean,
            default: true
        }
    },
    // Maintenance mode
    maintenance: {
        enabled: {
            type: Boolean,
            default: false
        },
        message: {
            type: String,
            default: ''
        }
    }
}, {
    timestamps: true
});

// Ensure only one content document exists
contentSchema.statics.getContent = async function() {
    let content = await this.findOne();
    if (!content) {
        content = await this.create({});
    }
    return content;
};

module.exports = mongoose.model('Content', contentSchema);
