# Mood System Assets Guide

The virtual buddy now has a dynamic mood system that changes based on task urgency and completion!

## How It Works

### Mood States

1. **Stressed 😰**
   - Triggers when: 3+ urgent tasks (due < 7 days) OR 50%+ of tasks are urgent
   - The buddy appears anxious/stressed

2. **Normal 😊**
   - Default state
   - Triggers when: Not stressed, not happy - just working through tasks

3. **Happy 🎉**
   - Triggers when: No urgent tasks AND at least 50% of all tasks completed
   - The buddy is relaxed and happy!

### Dynamic Changes

- **As you complete tasks**: The buddy gradually becomes less stressed
- **As deadlines approach**: The buddy becomes more stressed
- **When you're caught up**: The buddy becomes happy!

## Required Assets

To fully implement the mood system, add these files to `/apps/web/public/`:

### Images (Static, shown when not talking)

- `/public/stress.png` - Stressed/anxious expression ✅ (already exists)
- `/public/image.png` - Normal expression ✅ (already exists, also used as fallback for happy)
- `/public/image-happy.png` - Happy/relaxed expression (optional - uses normal image as fallback)

### Videos (Animated, shown when talking/TTS enabled)

- `/public/stress_video.mp4` - Stressed talking animation ✅ (already exists)
- `/public/IMG_2476.MOV` - Normal talking animation ✅ (already exists)
- `/public/video-happy.MOV` - Happy talking animation (optional - uses normal video as fallback)

## Fallback Behavior

If mood-specific assets don't exist, the system automatically falls back to the normal assets:
- Missing stressed/happy images → uses `image.png`
- Missing stressed/happy videos → uses `IMG_2476.MOV`

So the feature works immediately, but will be even better with custom assets!

## Asset Recommendations

### For Stressed State:
- Worried expression
- Furrowed brows
- Slightly nervous animation
- Faster/more anxious movements in video

### For Happy State:
- Big smile
- Relaxed posture
- Calm animation
- Smooth, content movements in video

## Testing

To test different moods:
1. **Stressed**: Add 3+ assignments with due dates < 7 days
2. **Normal**: Have some tasks but not urgent
3. **Happy**: Complete 50%+ of your tasks with no urgent ones

The mood indicator badge appears in the top-left of the avatar showing the current state!
