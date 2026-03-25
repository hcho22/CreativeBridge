# Services (`src/services/`)

## Service Pattern

Services use class pattern with singleton export:

```typescript
export class ServiceName {
  public async method(params: Type): Promise<ReturnType> {
    // Implementation
  }
}
export const serviceName = new ServiceName();
```

## Error Handling

- Services throw descriptive errors with context
- Components handle errors and show user-friendly messages
- All API calls include timeout and retry logic

## Service Catalog

### Story Engine

- `storyGenerationService.ts` - AI-powered story continuation with GPT-4
- `storyAgent.ts`, `enhancedStoryAgent.ts` - Multi-personality AI agents
- `storyImportService.ts` - Story import and continuation
- `storyManagementService.ts` - Story CRUD operations

### Image Generation

- `imageGeneration.ts` - Replicate API with grade-appropriate art style enforcement
- Art styles defined in `ART_STYLE_MAPPING` (K-2 watercolor, 3-5 digital, 6-8 realistic, 9-12 sophisticated)
- 3-tier prompt generation: story-specific > advanced NER > grade-appropriate fallback
- XP cost: `IMAGE_GENERATION_COST = 1000`
- Art style details: `.claude/.agent/SOP/image-generation-art-styles.md`

### AI Enhancement

- `claudeSkillsManager.ts` - Claude Skills SDK integration for quality assessment
- `claudeSkillsConfigManager.ts` - Skills configuration management
- `claudeSkillsMonitor.ts` - Skills performance monitoring

### Infrastructure

- `convex.ts` - Convex client initialization (PRIMARY for OAuth users)
- `supabase.ts` - Supabase client (FALLBACK for legacy users)
- `xpEventTracker.ts` - Gamification and XP tracking
- `analyticsService.ts` - User behavior tracking

### Storage

- `imageStorageService.ts` - Image storage via Convex
- `postGenerationStorageService.ts` - Post-generation image processing and storage

### Onboarding

- `onboardingService.ts` - Centralized onboarding logic
- `onboardingMilestoneTracker.ts` - Local milestone state tracking

## Testing

- Set `DISABLE_XP_COSTS_FOR_TESTING=true` in `.env` to bypass XP cost checks
- Service tests live in `src/__tests__/services/`
