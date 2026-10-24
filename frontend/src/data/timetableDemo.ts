// Test fixture only. The production timetable workspace loads academic records from the API.
import type { SelectOption, TimetableSession } from '../lib/timetable'

export const institutionOptions: SelectOption[] = [
  { id: 'northbridge', label: 'Northbridge University' },
  { id: 'lakeside', label: 'Lakeside Institute' },
]

export const departmentOptions: SelectOption[] = [
  { id: 'computing', label: 'School of Computing' },
  { id: 'engineering', label: 'Faculty of Engineering' },
]

export const semesterOptions: SelectOption[] = [
  { id: 'semester-1', label: 'Semester 1 · 2026' },
  { id: 'semester-2', label: 'Semester 2 · 2026' },
]

export const sectionOptions: SelectOption[] = [
  { id: 'cs-y1-a', label: 'Computer Science · Year 1 · Section A' },
  { id: 'cs-y1-b', label: 'Computer Science · Year 1 · Section B' },
]

export const subjectOptions: SelectOption[] = [
  { id: 'algorithms', label: 'Algorithms & Data Structures' },
  { id: 'databases', label: 'Database Systems' },
  { id: 'web-engineering', label: 'Web Engineering' },
  { id: 'networks', label: 'Computer Networks' },
  { id: 'software-lab', label: 'Software Engineering Lab' },
]

export const teacherOptions: SelectOption[] = [
  { id: 'dr-lee', label: 'Dr. Jordan Lee' },
  { id: 'prof-amin', label: 'Prof. Samira Amin' },
  { id: 'dr-morgan', label: 'Dr. Alex Morgan' },
  { id: 'ms-chen', label: 'Ms. Riley Chen' },
]

export const roomOptions: SelectOption[] = [
  { id: 'room-201', label: 'Room 201' },
  { id: 'room-305', label: 'Room 305' },
  { id: 'lab-1', label: 'Computing Lab 1' },
  { id: 'lab-2', label: 'Computing Lab 2' },
]

export const demoSessions: TimetableSession[] = [
  { id: 'demo-1', classGroupId: 'cs-y1-a', day: 'monday', startTime: '09:00', endTime: '10:00', subjectId: 'algorithms', teacherId: 'dr-lee', roomId: 'room-201', type: 'Lecture' },
  { id: 'demo-2', classGroupId: 'cs-y1-a', day: 'monday', startTime: '10:30', endTime: '12:00', subjectId: 'software-lab', teacherId: 'ms-chen', roomId: 'lab-1', type: 'Laboratory' },
  { id: 'demo-3', classGroupId: 'cs-y1-a', day: 'tuesday', startTime: '09:00', endTime: '10:00', subjectId: 'databases', teacherId: 'prof-amin', roomId: 'room-305', type: 'Lecture' },
  { id: 'demo-4', classGroupId: 'cs-y1-a', day: 'wednesday', startTime: '11:00', endTime: '12:00', subjectId: 'web-engineering', teacherId: 'dr-morgan', roomId: 'room-201', type: 'Lecture' },
  { id: 'demo-5', classGroupId: 'cs-y1-a', day: 'thursday', startTime: '13:00', endTime: '14:30', subjectId: 'networks', teacherId: 'dr-lee', roomId: 'room-305', type: 'Tutorial' },
  { id: 'demo-6', classGroupId: 'cs-y1-a', day: 'friday', startTime: '09:00', endTime: '11:00', subjectId: 'software-lab', teacherId: 'ms-chen', roomId: 'lab-2', type: 'Laboratory' },
  { id: 'demo-7', classGroupId: 'cs-y1-a', day: 'saturday', startTime: '10:00', endTime: '11:00', subjectId: 'algorithms', teacherId: 'dr-morgan', roomId: 'room-201', type: 'Tutorial' },
  { id: 'demo-8', classGroupId: 'cs-y1-b', day: 'monday', startTime: '09:00', endTime: '10:30', subjectId: 'databases', teacherId: 'prof-amin', roomId: 'room-305', type: 'Lecture' },
  { id: 'demo-9', classGroupId: 'cs-y1-b', day: 'wednesday', startTime: '14:00', endTime: '16:00', subjectId: 'software-lab', teacherId: 'ms-chen', roomId: 'lab-1', type: 'Laboratory' },
]
