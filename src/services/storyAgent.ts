// Story Agent Service for CreativeBridge
// Ports CrewAI agent logic to TypeScript/React Native with enhanced features

import {
  StoryRequest,
  StoryResponse,
  ContentValidationResult,
  GradeLevel,
} from '../types';
import { storyGenerationService } from './storyGenerationService';
import {
  contentQualityService,
  QualityAssessmentResult,
} from './contentQuality';
import { SkillManager } from '../types/claudeSkills';
import { sanitizePromptInput } from './promptSanitizer';
import { checkOutputSafety } from './contentSafetyService';

interface StoryStarterRequest {
  gradeLevel: GradeLevel;
  theme?: string;
  character?: string;
  characterName?: string; // Raw user-chosen name, exempt from PII scrubbing
  setting?: string;
  sessionId?: string; // Optional session ID for diversity tracking
  userId?: string; // Optional user ID for diversity tracking
  storyId?: string; // Optional story ID for post-generation element storage
}

interface StoryContinuationRequest extends StoryRequest {
  consistencyCheck?: boolean;
  qualityThreshold?: number;
}

interface AgentPersonality {
  creativity: number;
  consistency: number;
  safety: number;
  engagement: number;
}

interface StoryQualityMetrics {
  coherence: number;
  engagement: number;
  appropriateness: number;
  creativity: number;
  overall: number;
}

interface ConsistencyCheck {
  isConsistent: boolean;
  issues: string[];
  suggestions: string[];
}

// ─── Token-Aware Truncation (US-006: U-6.4) ────────────────────────────────

/** Rough token estimate: ~4 chars per token for English text. */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Maximum tokens to allocate for story context within the model's window. */
const MAX_STORY_TOKENS = 6000;

/** Number of recent story rounds to always preserve. */
const PRESERVE_RECENT_ROUNDS = 3;

/** Round separator pattern — stories use double newlines between rounds. */
const ROUND_SEPARATOR = /\n\n+/;

/**
 * Truncate a long story to fit within the token budget.
 * Preserves the most recent rounds and summarizes earlier content.
 * Short stories pass through verbatim.
 */
function truncateStoryForContext(storySoFar: string): string {
  if (!storySoFar) return storySoFar;

  const tokens = estimateTokens(storySoFar);
  if (tokens <= MAX_STORY_TOKENS) return storySoFar;

  const rounds = storySoFar.split(ROUND_SEPARATOR).filter(r => r.trim());
  if (rounds.length <= PRESERVE_RECENT_ROUNDS) {
    // Can't split further — just hard-truncate from the front
    const maxChars = MAX_STORY_TOKENS * 4;
    return storySoFar.slice(-maxChars);
  }

  // Always keep the last N rounds
  const recentRounds = rounds.slice(-PRESERVE_RECENT_ROUNDS);
  const earlierRounds = rounds.slice(0, -PRESERVE_RECENT_ROUNDS);

  // Extract key narrative elements from earlier rounds
  const firstRound = earlierRounds[0] || '';
  // Grab character names (capitalized words that appear more than once)
  const namePattern = /\b([A-Z][a-z]{2,})\b/g;
  const nameCounts = new Map<string, number>();
  for (const round of earlierRounds) {
    for (const match of round.matchAll(namePattern)) {
      nameCounts.set(match[1], (nameCounts.get(match[1]) || 0) + 1);
    }
  }
  const characterNames = [...nameCounts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([name]) => name)
    .slice(0, 5);

  // Build a condensed summary of earlier content
  const settingSnippet = firstRound.substring(0, 200);
  const characters =
    characterNames.length > 0
      ? `Characters: ${characterNames.join(', ')}.`
      : '';

  const summary = [
    '[Story so far summarized]',
    settingSnippet.trim() + (settingSnippet.length >= 200 ? '...' : ''),
    characters,
    `(${earlierRounds.length} earlier rounds condensed)`,
  ]
    .filter(Boolean)
    .join('\n');

  const truncated = summary + '\n\n' + recentRounds.join('\n\n');

  // Final safety check — if still too long, hard-truncate
  if (estimateTokens(truncated) > MAX_STORY_TOKENS) {
    return truncated.slice(-(MAX_STORY_TOKENS * 4));
  }

  return truncated;
}

// ─── End Token-Aware Truncation ─────────────────────────────────────────────

class StoryAgentService {
  private personalities: Record<string, AgentPersonality>;
  private qualityThresholds: Record<GradeLevel, number>;
  private safetyKeywords: Record<GradeLevel, string[]>;
  private skillManager?: SkillManager;
  private claudeQualityEnabled: boolean = false;

  constructor() {
    this.personalities = this.initializePersonalities();
    this.qualityThresholds = this.initializeQualityThresholds();
    this.safetyKeywords = this.initializeSafetyKeywords();
  }

  /**
   * Initialize Claude-powered quality assessment
   */
  public initializeClaudeQuality(skillManager: SkillManager): void {
    this.skillManager = skillManager;
    this.claudeQualityEnabled = true;

    // Initialize content quality service with skill manager
    (contentQualityService as any).skillManager = skillManager;
  }

  private initializePersonalities(): Record<string, AgentPersonality> {
    return {
      creative_writer: {
        creativity: 0.9,
        consistency: 0.7,
        safety: 1.0,
        engagement: 0.8,
      },
      story_partner: {
        creativity: 0.7,
        consistency: 0.9,
        safety: 1.0,
        engagement: 0.9,
      },
      educational_guide: {
        creativity: 0.6,
        consistency: 0.8,
        safety: 1.0,
        engagement: 0.7,
      },
    };
  }

  private initializeQualityThresholds(): Record<GradeLevel, number> {
    // Lower thresholds to be more permissive and allow varied stories
    return {
      'K-2': 0.3,
      '3-5': 0.4,
      '6-8': 0.4,
      '9-12': 0.4,
    };
  }

  private initializeSafetyKeywords(): Record<GradeLevel, string[]> {
    return {
      'K-2': [
        'happy',
        'fun',
        'friend',
        'play',
        'learn',
        'discover',
        'colorful',
        'magical',
        'adventure',
        'kind',
        'helpful',
        'curious',
      ],
      '3-5': [
        'brave',
        'clever',
        'solve',
        'explore',
        'teamwork',
        'mystery',
        'invention',
        'nature',
        'friendship',
        'challenge',
        'creative',
      ],
      '6-8': [
        'determination',
        'perseverance',
        'innovation',
        'collaboration',
        'discovery',
        'growth',
        'leadership',
        'responsibility',
      ],
      '9-12': [
        'resilience',
        'integrity',
        'empathy',
        'transformation',
        'self-discovery',
        'achievement',
        'potential',
        'purpose',
      ],
    };
  }

  public async generateStoryStarter(
    request: StoryStarterRequest,
  ): Promise<StoryResponse> {
    try {
      const enhancedRequest = this.buildStarterRequest(request);
      const response = await storyGenerationService.generateStory(
        enhancedRequest,
      );

      if (!response.success) {
        return response;
      }

      // Use Claude-powered quality assessment if available
      let qualityAssessment: QualityAssessmentResult | null = null;
      let qualityPassed = true;

      if (this.claudeQualityEnabled) {
        try {
          // Get user ID for adaptive thresholds (could be passed in request in future)
          const userId = 'anonymous-user'; // TODO: Get from request context when available

          qualityAssessment = await contentQualityService.assessContent(
            response,
            { gradeLevel: request.gradeLevel, userInput: '' },
            true,
            userId,
          );
          qualityPassed = qualityAssessment.passed;
        } catch (error) {
          console.warn(
            'Claude quality assessment failed, falling back to legacy assessment',
          );
          qualityPassed =
            this.assessStoryQuality(response.story, request.gradeLevel)
              .overall >= this.qualityThresholds[request.gradeLevel];
        }
      } else {
        // Legacy quality assessment
        const qualityCheck = this.assessStoryQuality(
          response.story,
          request.gradeLevel,
        );
        qualityPassed =
          qualityCheck.overall >= this.qualityThresholds[request.gradeLevel];
      }

      const safetyCheck = this.performSafetyCheck(
        response.story,
        request.gradeLevel,
      );

      if (!safetyCheck.isValid) {
        return {
          ...response,
          success: false,
          error: `Safety check failed: ${safetyCheck.violations.join(', ')}`,
        };
      }

      if (!qualityPassed) {
        // Use the enhanced storyGenerationService fallback instead of old static fallback
        const enhancedFallbackRequest = {
          gradeLevel: request.gradeLevel,
          userInput: `Generate an engaging story starter for grade level ${request.gradeLevel}`,
          challenge: this.getGradeLevelChallenge(request.gradeLevel),
        };

        const fallbackResponse = await storyGenerationService.generateStory(
          enhancedFallbackRequest,
        );
        return {
          ...fallbackResponse,
          error: 'Quality threshold not met, using enhanced fallback',
        };
      }

      return {
        ...response,
        story: this.enhanceStoryStarter(response.story, request),
      };
    } catch (error) {
      return {
        story: '',
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Story starter generation failed',
        gradeLevel: request.gradeLevel,
      };
    }
  }

  public async continueStory(
    request: StoryContinuationRequest,
  ): Promise<StoryResponse> {
    try {
      console.log('🎬 storyAgentService.continueStory called', {
        gradeLevel: request.gradeLevel,
        hasStorySoFar: !!request.storySoFar,
        userInputLength: request.userInput?.length || 0,
        userInputPreview: request.userInput?.substring(0, 100) + '...',
        storySoFarLength: request.storySoFar?.length || 0,
        storySoFarPreview: request.storySoFar?.substring(0, 100) + '...',
        consistencyCheck: request.consistencyCheck,
      });

      // Skip strict consistency checks for better user experience
      // Users should be able to add creative elements without constraint
      // Consistency checks are disabled to prevent blocking story generation

      // Truncate long stories to fit AI context window (US-006: U-6.4)
      if (request.storySoFar) {
        const originalStorySoFar = request.storySoFar;
        const originalLength = originalStorySoFar.length;
        const truncated = truncateStoryForContext(originalStorySoFar);
        request = {
          ...request,
          storySoFar: truncated,
        };
        if (truncated.length < originalLength) {
          console.log(
            `📏 Story truncated: ${originalLength} → ${
              truncated.length
            } chars (~${estimateTokens(truncated)} tokens)`,
          );
        }
      }

      const response = await storyGenerationService.generateStory(request);
      console.log('📝 storyGenerationService response:', {
        success: response.success,
        hasStory: !!response.story,
        storyLength: response.story?.length || 0,
        error: response.error,
      });

      if (!response.success) {
        console.log('❌ storyGenerationService failed, trying direct fallback');
        // Try a more direct fallback approach
        return await this.generateDirectFallback(request);
      }

      // Apply Claude-powered quality assessment if available
      if (this.claudeQualityEnabled && response.success) {
        try {
          // Get user ID for adaptive thresholds (could be passed in request in future)
          const userId = 'anonymous-user'; // TODO: Get from request context when available

          const qualityAssessment = await contentQualityService.assessContent(
            response,
            request,
            true,
            userId,
          );

          console.log('🔍 Claude quality assessment:', {
            passed: qualityAssessment.passed,
            overallScore: qualityAssessment.metrics.overallScore,
            confidence: qualityAssessment.confidence,
            issueCount: qualityAssessment.issues.length,
            adaptiveThresholdsUsed: true,
          });

          // Log quality metrics but don't block story generation for user experience
          if (!qualityAssessment.passed) {
            console.log(
              '⚠️ Quality assessment concerns:',
              qualityAssessment.issues,
            );
          }
        } catch (error) {
          console.warn(
            'Claude quality assessment failed during continuation:',
            error,
          );
        }
      }

      console.log('✅ Story generated successfully, returning result');
      return response;
    } catch (error) {
      console.error('❌ storyAgentService.continueStory error:', error);
      // Provide a guaranteed fallback
      return await this.generateDirectFallback(request);
    }
  }

  private async generateDirectFallback(
    request: StoryContinuationRequest,
  ): Promise<StoryResponse> {
    console.log('🆘 generateDirectFallback called');

    try {
      // Create a fallback request with shortened user input to avoid validation issues
      const shortenedUserInput = request.userInput
        ? request.userInput.substring(0, 800) // Use first 800 chars to stay under limit
        : 'Continue the story';

      const fallbackRequest = {
        gradeLevel: request.gradeLevel,
        storySoFar: request.storySoFar,
        userInput: shortenedUserInput,
        challenge: 'Create an engaging continuation',
        // Pass through diversity tracking IDs even in fallback mode
        sessionId: request.sessionId,
        userId: request.userId,
        storyId: request.storyId,
      };

      // Force fallback mode by temporarily removing API key
      const originalConfig = storyGenerationService.getConfig();
      storyGenerationService.updateConfig({
        apiKey: '',
        fallbackEnabled: true,
      });

      const fallbackResponse = await storyGenerationService.generateStory(
        fallbackRequest,
      );

      // Restore original config
      storyGenerationService.updateConfig(originalConfig);

      console.log('🎪 Direct fallback result:', {
        success: fallbackResponse.success,
        hasStory: !!fallbackResponse.story,
        storyLength: fallbackResponse.story?.length || 0,
        error: fallbackResponse.error,
      });

      if (fallbackResponse.success && fallbackResponse.story) {
        return {
          ...fallbackResponse,
          error: 'Using enhanced fallback story generation',
        };
      }
    } catch (fallbackError) {
      console.error('❌ Direct fallback also failed:', fallbackError);
    }

    // Enhanced last resort - use story continuation templates directly
    console.log('🎭 Using enhanced story continuation templates');
    return this.generateEnhancedContinuation(request);
  }

  private generateEnhancedContinuation(
    request: StoryContinuationRequest,
  ): StoryResponse {
    // Analyze the story context to choose appropriate continuation
    const storyContext = (request.storySoFar || '').toLowerCase();
    const userContext = (request.userInput || '').toLowerCase();

    // Determine story theme based on content
    let theme = 'general';
    if (storyContext.includes('magic') || userContext.includes('magic')) {
      theme = 'magical';
    } else if (
      storyContext.includes('discover') ||
      userContext.includes('discover') ||
      userContext.includes('found')
    ) {
      theme = 'discovery';
    } else if (
      storyContext.includes('friend') ||
      userContext.includes('friend')
    ) {
      theme = 'friendship';
    } else if (
      storyContext.includes('animal') ||
      userContext.includes('animal')
    ) {
      theme = 'animal';
    }

    const continuationTemplates = {
      'K-2': {
        magical: [
          'The magic sparkled brighter and showed them something wonderful. It was more amazing than they had ever imagined.',
          'Magical lights danced around them as the adventure became even more exciting. The enchanted world had many surprises.',
          'The magical power grew stronger and helped them discover new friends. Everything felt warm and special.',
        ],
        discovery: [
          'What they found next was even more exciting than before. The discovery led to a new adventure full of wonder.',
          'They explored deeper and found amazing treasures hidden away. Each discovery made them more curious about what else was there.',
          'The path led them to a secret place where wonderful things were waiting. It was better than any dream.',
        ],
        friendship: [
          'Their new friend showed them how to have even more fun together. They laughed and played in the most wonderful way.',
          'All the friends worked together to make something special happen. The friendship made everything more magical.',
          'The friends decided to help each other on a new adventure. Together they could do anything.',
        ],
        animal: [
          'The little animal made new friends who wanted to join the adventure. All the animals played together happily.',
          'The animal discovered it had a special talent that helped everyone. All the forest creatures were amazed.',
          'Other animals came to see what was happening and wanted to help too. It became a wonderful animal celebration.',
        ],
        general: [
          'The adventure continued with exciting new discoveries ahead. Each step brought more wonderful surprises.',
          'Something amazing was about to happen that would make everything even better. The magic of the moment filled the air.',
          'What came next was more wonderful than anyone could have imagined. The adventure was just beginning.',
        ],
      },
      '3-5': {
        magical: [
          'The magical forces responded to their emotions, growing stronger with each moment of wonder and determination. Ancient secrets began to reveal themselves in ways they never expected.',
          'As their understanding of the magical world deepened, they realized they had the power to shape their own destiny. The magic was not just around them, but within them.',
          'The enchanted realm revealed layers of mystery that challenged everything they thought they knew about magic. Each discovery opened doors to greater adventures.',
        ],
        discovery: [
          'The investigation uncovered connections between seemingly unrelated events that pointed toward something extraordinary. Each clue led them deeper into a mystery that spanned generations.',
          'What they discovered challenged their understanding of reality itself, forcing them to question everything they had been taught. The truth was far more complex than they imagined.',
          'The evidence suggested that their discovery was part of a much larger pattern, one that had been hidden for decades. Now they had the chance to uncover the complete truth.',
        ],
        friendship: [
          'The friendship was tested by the challenges they faced, but it emerged stronger and more meaningful than before. Together they could overcome any obstacle.',
          'Working as a team, they discovered capabilities they never knew they possessed individually. Their combined strengths made them unstoppable.',
          'The bond between them became a source of courage that helped them face their fears and achieve the impossible. True friendship was their greatest power.',
        ],
        animal: [
          'The animal demonstrated intelligence and abilities that amazed everyone around them. It became clear that this creature was no ordinary companion.',
          'Communication between human and animal reached a new level of understanding, revealing wisdom that had been hidden for ages. They learned from each other.',
          'The animals instincts led them toward discoveries that would prove crucial to their mission. Ancient knowledge flowed through this special connection.',
        ],
        general: [
          'The next phase of their journey would test everything they had learned and push them beyond their comfort zone. Growth required courage.',
          'What happened next revealed the true scope of their adventure and the important role they were meant to play. Destiny was calling.',
          'The story took an unexpected turn that opened up possibilities they had never considered before. The real adventure was just beginning.',
        ],
      },
      '6-8': {
        magical: [
          'The supernatural forces at work proved more complex than anyone had realized, weaving together reality and possibility in ways that challenged conventional understanding. Magic was science they hadn\t yet comprehended.',
          'As their connection to the mystical elements deepened, they began to understand that magic wasn\t about power over others, but about harmony with the natural world. Balance was everything.',
          'The magical systems operating around them revealed an ancient network of energy and intention that connected all living things. They were part of something much larger than themselves.',
        ],
        discovery: [
          'The research led them to evidence that contradicted official records and suggested a deliberate cover-up spanning multiple generations. The truth had been systematically hidden.',
          'What they uncovered revealed a pattern of events that connected their local mystery to global phenomena, suggesting implications that reached far beyond their immediate situation.',
          'The investigation exposed systemic issues that challenged everything they had been taught about their communitys history. Reality was more complex than the official narrative suggested.',
        ],
        friendship: [
          'The relationship evolved as they navigated increasingly complex moral and ethical challenges that tested their values and forced them to grow. True friendship required difficult conversations.',
          'Their bond became a foundation for making difficult decisions in situations where there were no clear right answers. Together they could face moral complexity.',
          'The friendship provided perspective and support that helped them maintain their integrity while dealing with pressure from adults who didn\t understand their situation.',
        ],
        general: [
          'The complexity of their situation became apparent as multiple perspectives and competing interests created ethical dilemmas that had no easy solutions. Adulthood meant embracing ambiguity.',
          'As they gained deeper understanding of the forces shaping their world, they realized they had the power and responsibility to influence positive change. With knowledge came obligation.',
          'The events that followed would challenge their assumptions about authority, justice, and their own capabilities in ways that would shape their character forever.',
        ],
      },
      '9-12': {
        general: [
          'The philosophical implications of their situation demanded a careful examination of personal values against societal expectations, forcing them to define their own moral framework in an ambiguous world.',
          'As the layers of complexity revealed themselves, they grappled with questions of individual agency versus systemic influence, recognizing that personal choices existed within larger cultural and economic contexts.',
          'The experience catalyzed a fundamental shift in their understanding of adulthood, relationships, and responsibility, marking a transition from external validation to internal conviction about their place in the world.',
        ],
      },
    };

    const gradeTemplates = continuationTemplates[request.gradeLevel];
    const themeTemplates =
      gradeTemplates?.[theme as keyof typeof gradeTemplates] ||
      gradeTemplates?.general ||
      continuationTemplates['K-2'].general;

    const selectedTemplate =
      themeTemplates[Math.floor(Math.random() * themeTemplates.length)];

    console.log('📚 Enhanced continuation generated:', {
      gradeLevel: request.gradeLevel,
      theme,
      templateLength: selectedTemplate.length,
    });

    return {
      story: selectedTemplate,
      success: true,
      gradeLevel: request.gradeLevel,
      error: 'Using enhanced story continuation templates',
    };
  }

  private buildStarterRequest(request: StoryStarterRequest): StoryRequest {
    // US-011: Sanitize user-provided fields before prompt assembly
    const safeTheme = request.theme
      ? sanitizePromptInput(request.theme)
      : undefined;
    const safeCharacter = request.character
      ? sanitizePromptInput(request.character)
      : undefined;
    const safeSetting = request.setting
      ? sanitizePromptInput(request.setting)
      : undefined;

    let prompt =
      'Create a sophisticated and engaging story opening that will captivate readers at the specified grade level';

    if (safeTheme) {
      prompt += ` exploring the rich theme of ${safeTheme} with depth and nuance`;
    }

    // The `inspired by` / `set in the world of` wording was treating the
    // user's explicit wizard choices as loose inspiration, so GPT-4 was
    // swapping them for generic YA tropes (e.g. "A shy dragon named Buttons
    // at a lighthouse" → "sixteen-year-old Maya finds an ancient map").
    // Switch to directive quoting with a CRITICAL prefix so the model treats
    // them as the requirements they are.
    if (safeCharacter) {
      prompt += `. CRITICAL: The main character is exactly this, do not substitute or reimagine: "${safeCharacter}". The opening must establish this character by the description above, not invent a different one.`;
    }

    if (safeSetting) {
      prompt += ` CRITICAL: The story is set in exactly this place, do not relocate to anywhere else: "${safeSetting}". The first scene must take place here.`;
    }

    const safetyWords = this.safetyKeywords[request.gradeLevel];
    const randomSafetyWord =
      safetyWords[Math.floor(Math.random() * safetyWords.length)];
    prompt += `. Weave the positive concept of "${randomSafetyWord}" organically into the narrative fabric, making it feel natural and meaningful rather than forced or didactic.`;

    prompt += ` The story should immediately establish emotional connection, create compelling questions that drive the reader forward, and use sophisticated language appropriate for the target grade level while maintaining accessibility and engagement.`;

    return {
      gradeLevel: request.gradeLevel,
      userInput: prompt,
      challenge: this.getGradeLevelChallenge(request.gradeLevel, request.theme),
      characterName: request.characterName,
      // Pass through diversity tracking IDs for element extraction and guidance
      sessionId: request.sessionId,
      userId: request.userId,
      storyId: request.storyId,
    };
  }

  private getGradeLevelChallenge(
    gradeLevel: GradeLevel,
    genre?: string,
  ): string {
    const challenges = {
      'K-2':
        'Create vivid sensory experiences using simple, clear language that helps young readers see, hear, and feel the story world. Focus on concrete imagery and emotional connection through relatable experiences.',
      '3-5':
        'Develop an intriguing problem or mystery that encourages critical thinking and demonstrates the power of teamwork, creativity, and perseverance. Include character growth and learning moments.',
      '6-8':
        'Craft complex emotional landscapes and character development while exploring themes of identity, friendship, and personal growth. Use sophisticated descriptive language and subtle symbolism appropriate for developing analytical skills.',
      '9-12':
        'Explore profound themes of human experience, philosophical questions, and complex moral choices. Develop psychologically realistic characters facing meaningful challenges that reflect real-world issues and encourage deep reflection.',
    };

    let challenge = challenges[gradeLevel];

    if (genre) {
      const genreChallengeModifiers: Record<string, string> = {
        Mystery:
          'Include a mysterious element that raises questions and invites the reader to search for clues.',
        Fantasy:
          'Include a fantastical element such as magic, mythical creatures, or an enchanted world that sparks imagination.',
        Comedy:
          'Include a humorous moment or funny character trait that brings lighthearted fun to the story.',
        Horror:
          'Include a spooky or suspenseful element that builds tension and keeps the reader on edge.',
        Fiction:
          'Include a realistic yet compelling scenario that draws the reader into an emotionally authentic world.',
        'Fairy Tale':
          'Include a classic fairy tale element such as a moral lesson, a magical transformation, or a quest.',
      };

      const modifier = genreChallengeModifiers[genre];
      if (modifier) {
        challenge += ' ' + modifier;
      }
    }

    return challenge;
  }

  private assessStoryQuality(
    story: string,
    gradeLevel: GradeLevel,
  ): StoryQualityMetrics {
    const coherence = this.assessCoherence(story);
    const engagement = this.assessEngagement(story, gradeLevel);
    const appropriateness = this.assessAppropiateness(story, gradeLevel);
    const creativity = this.assessCreativity(story);

    const overall = (coherence + engagement + appropriateness + creativity) / 4;

    return {
      coherence,
      engagement,
      appropriateness,
      creativity,
      overall,
    };
  }

  private assessCoherence(story: string): number {
    const sentences = story.split(/[.!?]+/).filter(s => s.trim().length > 0);

    if (sentences.length < 2) return 0.5;

    let coherenceScore = 0.8;

    for (let i = 1; i < sentences.length; i++) {
      const prev = sentences[i - 1].toLowerCase();
      const curr = sentences[i].toLowerCase();

      const commonWords = this.findCommonWords(prev, curr);
      if (commonWords.length > 0) {
        coherenceScore += 0.1;
      }
    }

    return Math.min(coherenceScore, 1.0);
  }

  private assessEngagement(story: string, gradeLevel: GradeLevel): number {
    const engagementWords = {
      'K-2': ['fun', 'exciting', 'colorful', 'magical', 'surprise'],
      '3-5': ['adventure', 'mystery', 'discover', 'amazing', 'wonderful'],
      '6-8': ['thrilling', 'fascinating', 'incredible', 'extraordinary'],
      '9-12': ['compelling', 'intriguing', 'captivating', 'remarkable'],
    };

    const storyLower = story.toLowerCase();
    const relevantWords = engagementWords[gradeLevel];
    const foundWords = relevantWords.filter(word => storyLower.includes(word));

    return Math.min(0.5 + foundWords.length * 0.2, 1.0);
  }

  private assessAppropiateness(story: string, gradeLevel: GradeLevel): number {
    const storyLower = story.toLowerCase();
    const appropriateWords = this.safetyKeywords[gradeLevel];
    const foundAppropriate = appropriateWords.filter(word =>
      storyLower.includes(word.toLowerCase()),
    );

    // US-014: Use centralized content blocklist for appropriateness scoring
    const outputSafety = checkOutputSafety(story);
    if (!outputSafety.safe) {
      return 0.0;
    }

    return Math.min(0.6 + foundAppropriate.length * 0.1, 1.0);
  }

  private assessCreativity(story: string): number {
    const creativeElements = [
      'magical',
      'mysterious',
      'unexpected',
      'surprising',
      'unique',
      'special',
      'extraordinary',
      'wonderful',
      'amazing',
      'incredible',
    ];

    const storyLower = story.toLowerCase();
    const foundElements = creativeElements.filter(element =>
      storyLower.includes(element),
    );

    const uniqueWords = new Set(story.toLowerCase().split(/\s+/)).size;
    const totalWords = story.split(/\s+/).length;
    const vocabularyDiversity = uniqueWords / totalWords;

    const creativityScore = Math.min(
      0.4 + foundElements.length * 0.15 + vocabularyDiversity * 0.3,
      1.0,
    );

    return creativityScore;
  }

  private performSafetyCheck(
    story: string,
    _gradeLevel: GradeLevel,
  ): ContentValidationResult {
    const violations: string[] = [];
    const storyLower = story.toLowerCase();

    // Only check for truly harmful content, be more permissive for creative stories
    const unsafeContent = ['kill', 'murder', 'blood', 'war', 'hate'];

    for (const unsafe of unsafeContent) {
      if (storyLower.includes(unsafe)) {
        violations.push(`Contains unsafe content: ${unsafe}`);
      }
    }

    // Don't limit sentence count too strictly - stories can be longer
    const sentences = story.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length > 10) {
      violations.push('Story is extremely long');
    }

    return {
      isValid: violations.length === 0,
      violations,
    };
  }

  private checkStoryConsistency(story: string): ConsistencyCheck {
    const issues: string[] = [];
    const suggestions: string[] = [];

    const sentences = story.split(/[.!?]+/).filter(s => s.trim().length > 0);

    if (sentences.length < 2) {
      return { isConsistent: true, issues, suggestions };
    }

    const characters = this.extractCharacters(story);
    const settings = this.extractSettings(story);

    if (characters.length > 3) {
      issues.push('Too many characters introduced');
      suggestions.push('Focus on 1-2 main characters');
    }

    if (settings.length > 2) {
      issues.push('Multiple settings without clear transitions');
      suggestions.push('Stay in one setting or add clear transitions');
    }

    return {
      isConsistent: issues.length === 0,
      issues,
      suggestions,
    };
  }

  private checkStoryContinuity(
    previousStory: string,
    continuation: string,
  ): ContentValidationResult {
    const violations: string[] = [];

    const prevCharacters = this.extractCharacters(previousStory);
    const contCharacters = this.extractCharacters(continuation);

    const newCharacters = contCharacters.filter(
      char =>
        !prevCharacters.some(prev => prev.toLowerCase() === char.toLowerCase()),
    );

    if (newCharacters.length > 1) {
      violations.push('Too many new characters introduced in continuation');
    }

    const prevTense = this.detectTense(previousStory);
    const contTense = this.detectTense(continuation);

    if (prevTense !== contTense) {
      violations.push('Tense inconsistency between story parts');
    }

    return {
      isValid: violations.length === 0,
      violations,
    };
  }

  private extractCharacters(story: string): string[] {
    const commonNames = [
      'alice',
      'bob',
      'charlie',
      'diana',
      'eve',
      'frank',
      'grace',
      'henry',
      'ivy',
      'jack',
      'kate',
      'leo',
      'maya',
      'noah',
      'olivia',
      'peter',
      'quinn',
      'ruby',
      'sam',
      'tina',
      'uma',
      'victor',
      'wendy',
      'xavier',
      'yara',
      'zoe',
    ];

    const storyLower = story.toLowerCase();
    return commonNames.filter(name => storyLower.includes(name));
  }

  private extractSettings(story: string): string[] {
    const commonSettings = [
      'forest',
      'school',
      'home',
      'park',
      'library',
      'beach',
      'mountain',
      'city',
      'village',
      'castle',
      'garden',
      'room',
      'kitchen',
      'playground',
    ];

    const storyLower = story.toLowerCase();
    return commonSettings.filter(setting => storyLower.includes(setting));
  }

  private detectTense(story: string): 'past' | 'present' | 'future' {
    const pastIndicators = [
      'was',
      'were',
      'had',
      'did',
      'went',
      'said',
      'looked',
    ];
    const presentIndicators = [
      'is',
      'are',
      'has',
      'do',
      'goes',
      'says',
      'looks',
    ];
    const futureIndicators = ['will', 'shall', 'going to'];

    const storyLower = story.toLowerCase();

    const pastCount = pastIndicators.filter(word =>
      storyLower.includes(word),
    ).length;
    const presentCount = presentIndicators.filter(word =>
      storyLower.includes(word),
    ).length;
    const futureCount = futureIndicators.filter(word =>
      storyLower.includes(word),
    ).length;

    if (pastCount >= presentCount && pastCount >= futureCount) return 'past';
    if (futureCount >= presentCount) return 'future';
    return 'present';
  }

  private findCommonWords(text1: string, text2: string): string[] {
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);

    return words1.filter(word => words2.includes(word) && word.length > 3);
  }

  private enhanceStoryStarter(
    story: string,
    request: StoryStarterRequest,
  ): string {
    let enhanced = story;

    if (request.gradeLevel === 'K-2') {
      enhanced = this.simplifyLanguage(enhanced);
    } else if (request.gradeLevel === '9-12') {
      enhanced = this.addSophistication(enhanced);
    }

    return enhanced;
  }

  private simplifyLanguage(story: string): string {
    const complexWords = {
      discovered: 'found',
      magnificent: 'beautiful',
      extraordinary: 'special',
      mysterious: 'strange',
    };

    let simplified = story;
    for (const [complex, simple] of Object.entries(complexWords)) {
      simplified = simplified.replace(new RegExp(complex, 'gi'), simple);
    }

    return simplified;
  }

  private addSophistication(story: string): string {
    return story.replace(/\. /g, ', creating an atmosphere of intrigue. ');
  }

  private improveContinuation(
    previousStory: string,
    continuation: string,
    issues: string[],
  ): string {
    let improved = continuation;

    if (issues.includes('Tense inconsistency between story parts')) {
      const prevTense = this.detectTense(previousStory);
      improved = this.adjustTense(improved, prevTense);
    }

    return improved;
  }

  private adjustTense(
    story: string,
    targetTense: 'past' | 'present' | 'future',
  ): string {
    if (targetTense === 'past') {
      return story
        .replace(/\bis\b/g, 'was')
        .replace(/\bare\b/g, 'were')
        .replace(/\bhas\b/g, 'had')
        .replace(/\bgo\b/g, 'went');
    }

    return story;
  }

  private async regenerateWithHigherQuality(
    request: StoryContinuationRequest,
    qualityMetrics: StoryQualityMetrics,
  ): Promise<StoryResponse> {
    const enhancedRequest = {
      ...request,
      challenge: this.buildQualityImprovementChallenge(
        qualityMetrics,
        request.gradeLevel,
      ),
    };

    return await storyGenerationService.generateStory(enhancedRequest);
  }

  private buildQualityImprovementChallenge(
    metrics: StoryQualityMetrics,
    _gradeLevel: GradeLevel,
  ): string {
    const improvements: string[] = [];

    if (metrics.coherence < 0.7) {
      improvements.push('ensure smooth transitions between ideas');
    }

    if (metrics.engagement < 0.7) {
      improvements.push('add more exciting and engaging elements');
    }

    if (metrics.creativity < 0.7) {
      improvements.push('include more creative and imaginative details');
    }

    return `Focus on: ${improvements.join(', ')}`;
  }

  private async generateFallbackStarter(
    request: StoryStarterRequest,
  ): Promise<StoryResponse> {
    // Use the enhanced storyGenerationService fallback system for variety
    const enhancedFallbackRequest = {
      gradeLevel: request.gradeLevel,
      userInput: `Create an engaging story opening for grade level ${request.gradeLevel}`,
      challenge: this.getGradeLevelChallenge(request.gradeLevel),
    };

    try {
      const response = await storyGenerationService.generateStory(
        enhancedFallbackRequest,
      );
      if (response.success && response.story) {
        return {
          ...response,
          error: 'Using enhanced fallback story starter',
        };
      }
    } catch (error) {
      console.warn('Enhanced fallback failed, using basic fallback:', error);
    }

    // Only use basic fallback if enhanced system completely fails
    const basicFallbackStarters = {
      'K-2':
        'Once upon a time, there was a little animal who loved to explore.',
      '3-5':
        'Sarah looked outside and saw something amazing happening in her backyard.',
      '6-8':
        'The mysterious package arrived on a Tuesday, changing everything.',
      '9-12':
        'The decision that would change their life forever came disguised as an ordinary moment.',
    };

    return {
      story: basicFallbackStarters[request.gradeLevel],
      success: true,
      gradeLevel: request.gradeLevel,
      error: 'Using basic fallback story starter - enhanced system failed',
    };
  }

  public getAgentPersonalities(): Record<string, AgentPersonality> {
    return { ...this.personalities };
  }

  public updatePersonality(
    agentName: string,
    personality: Partial<AgentPersonality>,
  ): void {
    if (this.personalities[agentName]) {
      this.personalities[agentName] = {
        ...this.personalities[agentName],
        ...personality,
      };
    }
  }
}

export const storyAgentService = new StoryAgentService();
export default StoryAgentService;
