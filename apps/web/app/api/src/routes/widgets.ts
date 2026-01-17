// Widgets router - RightNow and Schedule widgets
import { Router, Request, Response } from 'express';
import { getRightNowSuggestion } from '../services/rightnowService';
import { getScheduleInfo } from '../services/schedulerService';

const router = Router();

/**
 * Get RightNow widget suggestion - prioritizes Canvas assignments by due date.
 * 
 * Returns the most urgent task or upcoming class suggestion.
 */
router.get('/right-now', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) {
      return res.status(400).json({ error: 'userId query parameter is required' });
    }

    const result = await getRightNowSuggestion(userId);
    res.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: `Error getting right now suggestion: ${errorMessage}` });
  }
});

/**
 * Get Schedule widget information - clash detection and next class reminder.
 * 
 * Returns:
 * - hasClash: Whether there are overlapping schedule events
 * - clashes: List of detected clashes
 * - nextClass: Information about the next upcoming class
 * - timeUntilNext: Time until next class
 */
router.get('/schedule', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) {
      return res.status(400).json({ error: 'userId query parameter is required' });
    }

    const result = await getScheduleInfo(userId);
    res.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: `Error getting schedule info: ${errorMessage}` });
  }
});

export default router;
