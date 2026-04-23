// services/websocket.js - Real-time WebSocket Service
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const Customer = require('../models/Customer');
const Admin = require('../models/Admin');

class WebSocketService {
    constructor() {
        this.wss = null;
        this.clients = new Map(); // Map of connected clients
        this.rooms = new Map(); // Map of rooms (customer, admin, global)
        this.init();
    }

    init() {
        // Initialize WebSocket server
        this.wss = new WebSocket.Server({ 
            port: process.env.WS_PORT || 8080,
            path: '/ws'
        });

        this.wss.on('connection', (ws, req) => {
            this.handleConnection(ws, req);
        });

        console.log('WebSocket server initialized on port', process.env.WS_PORT || 8080);
    }

    async handleConnection(ws, req) {
        const clientId = this.generateClientId();
        
        ws.clientId = clientId;
        ws.isAlive = true;
        ws.isAuthenticated = false;
        ws.user = null;

        // Add to clients map
        this.clients.set(clientId, {
            ws,
            user: null,
            rooms: new Set(),
            lastActivity: Date.now()
        });

        // Setup ping/pong for connection health
        ws.on('pong', () => {
            ws.isAlive = true;
        });

        // Handle messages
        ws.on('message', async (message) => {
            try {
                const data = JSON.parse(message);
                await this.handleMessage(ws, data);
            } catch (error) {
                this.sendError(ws, 'Invalid message format');
            }
        });

        // Handle disconnection
        ws.on('close', () => {
            this.handleDisconnection(clientId);
        });

        // Handle errors
        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
            this.handleDisconnection(clientId);
        });

        // Send welcome message
        this.sendToClient(clientId, {
            type: 'welcome',
            message: 'Connected to Linknet Fiber WebSocket',
            clientId: clientId
        });
    }

    async handleMessage(ws, data) {
        const client = this.clients.get(ws.clientId);
        
        switch (data.type) {
            case 'authenticate':
                await this.authenticateClient(ws, data);
                break;
                
            case 'join_room':
                await this.joinRoom(ws.clientId, data.room);
                break;
                
            case 'leave_room':
                await this.leaveRoom(ws.clientId, data.room);
                break;
                
            case 'ping':
                this.sendToClient(ws.clientId, { type: 'pong' });
                break;
                
            default:
                this.sendError(ws, 'Unknown message type');
        }
    }

    async authenticateClient(ws, data) {
        try {
            const { token, userType } = data;
            
            if (!token) {
                this.sendError(ws, 'Authentication token required');
                return;
            }

            // Verify JWT token
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'linknet-admin-secret-2024');
            
            let user;
            if (userType === 'admin') {
                user = await Admin.findById(decoded.id).select('-password');
            } else {
                user = await Customer.findOne({ customerId: decoded.customerId }).select('-password');
            }

            if (!user) {
                this.sendError(ws, 'Invalid authentication');
                return;
            }

            // Update client info
            ws.isAuthenticated = true;
            ws.user = user;
            ws.userType = userType;

            const client = this.clients.get(ws.clientId);
            client.user = user;
            client.userType = userType;

            // Join appropriate rooms
            if (userType === 'admin') {
                await this.joinRoom(ws.clientId, 'admin');
                await this.joinRoom(ws.clientId, 'global');
            } else {
                await this.joinRoom(ws.clientId, `customer_${user.customerId}`);
                await this.joinRoom(ws.clientId, 'global');
            }

            this.sendToClient(ws.clientId, {
                type: 'authenticated',
                message: 'Authentication successful',
                user: {
                    id: user._id || user.customerId,
                    name: user.fullname || user.name,
                    type: userType
                }
            });

        } catch (error) {
            console.error('Authentication error:', error);
            this.sendError(ws, 'Authentication failed');
        }
    }

    async joinRoom(clientId, roomName) {
        const client = this.clients.get(clientId);
        if (!client) return;

        // Add client to room
        if (!this.rooms.has(roomName)) {
            this.rooms.set(roomName, new Set());
        }
        
        this.rooms.get(roomName).add(clientId);
        client.rooms.add(roomName);

        this.sendToClient(clientId, {
            type: 'room_joined',
            room: roomName
        });

        // Notify others in the room
        this.broadcastToRoom(roomName, {
            type: 'user_joined',
            user: client.user ? {
                id: client.user._id || client.user.customerId,
                name: client.user.fullname || client.user.name,
                type: client.userType
            } : null
        }, clientId);
    }

    async leaveRoom(clientId, roomName) {
        const client = this.clients.get(clientId);
        if (!client) return;

        client.rooms.delete(roomName);
        
        if (this.rooms.has(roomName)) {
            this.rooms.get(roomName).delete(clientId);
            
            // Remove empty rooms
            if (this.rooms.get(roomName).size === 0) {
                this.rooms.delete(roomName);
            }
        }

        this.sendToClient(clientId, {
            type: 'room_left',
            room: roomName
        });

        // Notify others in the room
        this.broadcastToRoom(roomName, {
            type: 'user_left',
            user: client.user ? {
                id: client.user._id || client.user.customerId,
                name: client.user.fullname || client.user.name,
                type: client.userType
            } : null
        }, clientId);
    }

    handleDisconnection(clientId) {
        const client = this.clients.get(clientId);
        if (!client) return;

        // Remove from all rooms
        client.rooms.forEach(room => {
            if (this.rooms.has(room)) {
                this.rooms.get(room).delete(clientId);
                
                // Remove empty rooms
                if (this.rooms.get(room).size === 0) {
                    this.rooms.delete(room);
                }
            }
        });

        // Remove client
        this.clients.delete(clientId);

        console.log(`Client ${clientId} disconnected`);
    }

    sendToClient(clientId, message) {
        const client = this.clients.get(clientId);
        if (client && client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify(message));
        }
    }

    sendError(clientId, error) {
        this.sendToClient(clientId, {
            type: 'error',
            error: error
        });
    }

    broadcastToRoom(roomName, message, excludeClientId = null) {
        const room = this.rooms.get(roomName);
        if (!room) return;

        room.forEach(clientId => {
            if (clientId !== excludeClientId) {
                this.sendToClient(clientId, message);
            }
        });
    }

    broadcastToAll(message, excludeClientId = null) {
        this.clients.forEach((client, clientId) => {
            if (clientId !== excludeClientId) {
                this.sendToClient(clientId, message);
            }
        });
    }

    // Notification methods
    notifyNewCustomer(customer) {
        this.broadcastToRoom('admin', {
            type: 'new_customer',
            data: {
                customerId: customer.customerId,
                fullname: customer.fullname,
                email: customer.email,
                phone: customer.phone,
                registrationDate: customer.registrationDate
            }
        });
    }

    notifyNewSupportTicket(ticket, customer) {
        this.broadcastToRoom('admin', {
            type: 'new_support_ticket',
            data: {
                ticketId: ticket.ticketId,
                category: ticket.category,
                subject: ticket.subject,
                priority: ticket.priority,
                customer: {
                    id: customer.customerId,
                    name: customer.fullname
                },
                createdAt: ticket.createdAt
            }
        });

        // Also notify customer
        this.broadcastToRoom(`customer_${customer.customerId}`, {
            type: 'support_ticket_created',
            data: {
                ticketId: ticket.ticketId,
                subject: ticket.subject,
                status: 'pending'
            }
        });
    }

    notifyPaymentReceived(customer, paymentDetails) {
        this.broadcastToRoom(`customer_${customer.customerId}`, {
            type: 'payment_received',
            data: {
                amount: paymentDetails.amount,
                transactionId: paymentDetails.transactionId,
                method: paymentDetails.method,
                date: paymentDetails.date
            }
        });

        this.broadcastToRoom('admin', {
            type: 'payment_notification',
            data: {
                customer: {
                    id: customer.customerId,
                    name: customer.fullname
                },
                amount: paymentDetails.amount,
                transactionId: paymentDetails.transactionId,
                method: paymentDetails.method
            }
        });
    }

    notifyServiceUpdate(customer, updateDetails) {
        this.broadcastToRoom(`customer_${customer.customerId}`, {
            type: 'service_update',
            data: updateDetails
        });
    }

    notifySystemMaintenance(message, severity = 'info') {
        this.broadcastToAll({
            type: 'system_maintenance',
            data: {
                message,
                severity,
                timestamp: new Date()
            }
        });
    }

    notifyPackageUpgrade(customer, upgradeDetails) {
        this.broadcastToRoom(`customer_${customer.customerId}`, {
            type: 'package_upgrade',
            data: upgradeDetails
        });

        this.broadcastToRoom('admin', {
            type: 'customer_package_upgrade',
            data: {
                customer: {
                    id: customer.customerId,
                    name: customer.fullname
                },
                upgrade: upgradeDetails
            }
        });
    }

    // Health check
    startHealthCheck() {
        setInterval(() => {
            this.clients.forEach((client, clientId) => {
                if (!client.ws.isAlive) {
                    this.handleDisconnection(clientId);
                } else {
                    client.ws.isAlive = false;
                    client.ws.ping();
                }
            });
        }, 30000); // 30 seconds
    }

    generateClientId() {
        return Math.random().toString(36).substr(2, 9);
    }

    // Get statistics
    getStats() {
        return {
            connectedClients: this.clients.size,
            rooms: Array.from(this.rooms.entries()).map(([name, clients]) => ({
                name,
                clients: clients.size
            })),
            authenticatedClients: Array.from(this.clients.values()).filter(c => c.user).length
        };
    }
}

// Export singleton instance
const wsService = new WebSocketService();
wsService.startHealthCheck();

module.exports = wsService;
