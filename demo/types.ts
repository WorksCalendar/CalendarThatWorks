type EmployeeId = string;

interface DemoEmployee {
    id: EmployeeId;
    name: string;
    position: string;
    department: string;
}

interface DemoAssetResource {
    assetId: string;
    type: string;
    status: string;
}

type ApprovalStage = 'pending' | 'approved' | 'rejected';

interface ApprovalActionPayload {
    action: 'approve' | 'reject';
    comment?: string;
}

interface DemoEvent {
    eventId: string;
    title: string;
    date: Date;
    attendees: DemoEmployee[];
}

interface DemoNote {
    noteId: string;
    content: string;
    createdAt: Date;
    author: DemoEmployee;
}

interface DemoNotesMap {
    [key: string]: DemoNote;
}

interface DemoCategory {
    categoryId: string;
    name: string;
}

interface DemoPool {
    poolId: string;
    name: string;
    members: DemoEmployee[];
}

interface DemoProfile {
    profileId: string;
    employee: DemoEmployee;
    skills: string[];
}

interface RegionRecord {
    regionId: string;
    name: string;
}

interface BaseRecord {
    id: string;
    createdAt: Date;
    updatedAt: Date;
}

interface AssetRecord extends BaseRecord {
    assetResource: DemoAssetResource;
    allocations: any[];
}

interface PilotRecord extends BaseRecord {
    licenseNumber: string;
    experienceYears: number;
}

interface MedicalRecord extends BaseRecord {
    patientId: string;
    condition: string;
    treatment: string;
}

interface MechanicRecord extends BaseRecord {
    specialties: string[];
}

interface ShiftRecord extends BaseRecord {
    startTime: Date;
    endTime: Date;
    assignedEmployees: DemoEmployee[];
}

interface MaintenanceRecord extends BaseRecord {
    assetId: string;
    description: string;
    scheduledDate: Date;
}

interface RequestRecord extends BaseRecord {
    requester: DemoEmployee;
    status: string;
}

interface MissionLeg {
    legId: string;
    start: Date;
    end: Date;
}

interface CrewAssignment {
    assignmentId: string;
    missionLeg: MissionLeg;
    crew: DemoEmployee[];
}

interface ComplianceItem {
    itemId: string;
    requirement: string;
    status: string;
}

interface MissionRecord extends BaseRecord {
    missionId: string;
    legs: MissionLeg[];
    crewAssignments: CrewAssignment[];
}