// TypeScript type definitions for the demo application

// Type representing an employee
export type Employee = {
    id: string;
    name: string;
    email: string;
    position: string;
    hireDate: Date;
    department: string;
};

// Type representing an event
export type Event = {
    id: string;
    title: string;
    description?: string;
    startDate: Date;
    endDate: Date;
    location: string;
    attendees: Employee[];
};

// Type representing a category for events
export type Category = {
    id: string;
    name: string;
    color?: string;
};

// Type representing a pool of resources or events
export type Pool = {
    id: string;
    name: string;
    events: Event[];
};

// Type representing a user profile
export type Profile = {
    userId: string;
    employee: Employee;
    preferences: { [key: string]: any };
};

// Type representing EMS data record
export type EMSDataRecord = {
    recordId: string;
    employeeId: string;
    eventId: string;
    timestamp: Date;
    status: 'approved' | 'pending' | 'denied';
    notes?: string;
};
