// Question Analysis Service - Determines which API to call based on question intent

export type QuestionIntent = 'RIGHTNOW' | 'SCHEDULE' | 'BOTH' | 'GENERAL';

/**
 * Analyze a question to determine which API(s) should be called.
 * Uses keyword matching to identify if the question is about:
 * - RightNow: tasks, assignments, due dates, Canvas, homework
 * - Schedule: classes, timetable, schedule, NUSMods, modules
 */
export function analyzeQuestionIntent(question: string): QuestionIntent {
    const lowerQuestion = question.toLowerCase();

    // Keywords for RightNow/Tasks/Canvas
    const rightNowKeywords = [
        'rightnow', 'right now', 'task', 'tasks', 'assignment', 'assignments',
        'homework', 'due', 'deadline', 'canvas', 'todo', 'what should i do',
        'what do i need to do', 'urgent', 'priority', 'focus', 'work on'
    ];

    // Keywords for Schedule/Timetable/NUSMods
    const scheduleKeywords = [
        'schedule', 'timetable', 'class', 'classes', 'lecture', 'tutorial',
        'lab', 'nusmods', 'module', 'modules', 'when is', 'what time',
        'next class', 'today\'s class', 'tomorrow\'s class', 'venue', 'location'
    ];

    const hasRightNowIntent = rightNowKeywords.some(keyword =>
        lowerQuestion.includes(keyword)
    );

    const hasScheduleIntent = scheduleKeywords.some(keyword =>
        lowerQuestion.includes(keyword)
    );

    if (hasRightNowIntent && hasScheduleIntent) {
        return 'BOTH';
    } else if (hasRightNowIntent) {
        return 'RIGHTNOW';
    } else if (hasScheduleIntent) {
        return 'SCHEDULE';
    } else {
        return 'GENERAL';
    }
}
