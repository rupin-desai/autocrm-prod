# Mauli Car World - AutoCRM

## Overview
Mauli Car World is a comprehensive CRM system designed to manage car service operations across multiple locations. Its core purpose is to streamline customer and vehicle registration, service visit tracking, inventory management, employee administration (attendance, leaves, tasks), and order processing with invoicing. The system includes robust analytics, reporting, and a support ticket system. A key capability is its integration with WhatsApp for OTPs and customer notifications, aiming to enhance communication and operational efficiency for car service businesses.

## User Preferences
- Project uses MongoDB (not in-memory storage)
- WhatsApp integration for OTP and customer notifications
- Multi-shop support with role-based access control

## System Architecture
The application follows a client-server architecture.
- **Frontend**: Developed with React, Vite, TypeScript, TailwindCSS, and shadcn/ui. The UI/UX is designed with role-based dashboards, providing tailored views for different user roles (Admin, Manager, HR Manager, Inventory Manager, Sales Executive, Service Staff). These dashboards feature role-specific KPIs and content, such as service-related metrics for Sales Executives and support ticket metrics for Service Staff.
- **Backend**: Built using Node.js and Express with TypeScript. It exposes RESTful API endpoints for managing various entities and includes business logic for services like WhatsApp integration and PDF generation.
- **Database**: MongoDB Atlas is used for persistent data storage.
- **Authentication**: Passport.js is employed for authentication, utilizing OTP via WhatsApp.
- **Role-Based Access Control (RBAC)**: Comprehensive RBAC is implemented, ensuring least-privilege access. This includes permission-based sidebar navigation filtering and role-specific dashboard statistics.
- **Key Features**:
    - Shop-based multi-location management.
    - Customer and vehicle registration.
    - Multi-stage service visit tracking.
    - Inventory management with low stock alerts and Excel import/export.
    - **Product Management**: Products include mandatory Product Name field and optional Barcode Image upload (with preview and removal). Model Compatibility section positioned at bottom of form for better UX flow. Import/export utilities support productName and barcodeImage fields.
    - **Vehicle Compatibility Tracking**: Products can be assigned compatible vehicle brands/models via dropdown selection, with support for custom model entries. During vehicle registration, only compatible products are automatically displayed.
    - Employee management (attendance, leaves, task assignment).
    - Order processing with invoice generation and WhatsApp delivery.
    - Daily email reports.
    - Analytics and reporting capabilities.
    - Support ticket system with full CRUD operations.
    - Robust error logging and cache invalidation strategies for data consistency.
    - PDF generation for invoices with smart page breaks and accurate currency display.

## External Dependencies
- **Database**: MongoDB Atlas
- **Authentication**: Passport.js
- **Messaging**: WhatsApp Business API (for OTP, customer notifications, and invoice delivery)
- **Frontend Libraries**: React, Vite, TailwindCSS, shadcn/ui
- **Backend Libraries**: Node.js, Express, Mongoose