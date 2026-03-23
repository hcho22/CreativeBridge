// Story Generation Service for CreativeBridge
// Implements OpenAI integration with Story_Quest patterns and comprehensive error handling

// Removed OpenAI SDK - using React Native compatible client
import { openaiClient } from './openaiClient';
import { Environment } from '../config/environment';
import {
  StoryRequest,
  StoryResponse,
  AgentConfig,
  StoryAgents,
  ContentValidationResult,
  FallbackStory,
  StoryServiceConfig,
  StoryAnalysis,
} from '../types/story';
// Removed unused import: OpenAIMessage
import { GradeLevel } from '../types/database';

// Diversity tracking services
import { getOrCreateSessionWithAuth } from './diversitySessionService';
import { recentElementsService } from './recentElementsService';
import { diversityGuidanceService } from './diversityGuidanceService';
import { postGenerationStorageService } from './postGenerationStorageService';
import { diversityPerformanceMonitoringService } from './diversityPerformanceMonitoringService';

class StoryGenerationService {
  private config: StoryServiceConfig;
  private agents: StoryAgents;
  private fallbackStories: FallbackStory[];

  constructor() {
    this.config = {
      apiKey: '', // Now handled by openaiClient
      model: Environment.openai.model,
      maxTokens: 2000,
      temperature: 0.7,
      contentFilter: {
        maxSentences: 8, // Increased from 5 - OpenAI might generate longer responses
        minSentences: 1,
        inappropriateWords: ['kill', 'murder', 'blood', 'war', 'hate'],
        gradeAppropriate: true,
      },
      fallbackEnabled: true,
      retryAttempts: 3,
    };

    this.agents = this.initializeAgents();
    this.fallbackStories = this.initializeFallbackStories();
  }

  private isOpenAIAvailable(): boolean {
    const isConfigured = openaiClient.isConfigured();
    console.log('🔑 OpenAI availability check:', {
      isConfigured,
      fallbackEnabled: this.config.fallbackEnabled,
    });
    return isConfigured;
  }

  private initializeAgents(): StoryAgents {
    return {
      creative_writer: {
        role: 'Master Creative Writing Expert & Educational Story Architect',
        goal: "Generate imaginative, sophisticated, and educationally rich story content tailored to the student's selected grade level. Create compelling narratives that challenge readers intellectually while maintaining age-appropriate themes and vocabulary.",
        backstory:
          "You are a renowned children's and young adult author with decades of experience crafting award-winning stories. You have an advanced understanding of developmental psychology, reading comprehension levels, and educational storytelling techniques. Your expertise spans multiple genres, and you excel at creating narratives that spark imagination, promote critical thinking, and embed valuable life lessons. You understand how to balance entertainment with education, ensuring every story element serves both creative and pedagogical purposes. Your writing consistently receives praise for its sophisticated language use, compelling character development, and ability to engage readers at exactly their cognitive level while gently challenging them to grow.",
      },
      story_partner: {
        role: 'Expert Story Continuation Specialist & Literary Collaborator',
        goal: "Continue the student's story with seamless narrative flow, maintaining perfect consistency with established characters, settings, tone, and style while adding sophisticated plot development and character growth that feels natural and organic.",
        backstory:
          "You are a master collaborator and co-author who specializes in continuing existing narratives with such skill that readers cannot distinguish where the original writing ends and your continuation begins. You possess an exceptional ability to analyze writing style, voice, character development, and thematic elements, then replicate and enhance them perfectly. Your expertise includes understanding the subtle nuances of different grade levels, genres, and narrative techniques. You never impose your own creative agenda but instead serve as the perfect writing partner who elevates and extends the student's vision while maintaining their unique voice and creative ownership. Your continuations consistently surprise and delight while feeling completely authentic to the original narrative.",
      },
    };
  }

  private initializeFallbackStories(): FallbackStory[] {
    return [
      // K-2 Grade Level - Multiple variations per theme
      {
        template:
          "Luna the curious {animal} found a glowing {object} hidden beneath the old oak tree's twisted roots. When she touched it with her tiny paw, it whispered her name in a voice like tinkling bells.",
        gradeLevel: 'K-2',
        category: 'fantasy',
      },
      {
        template:
          "The little {animal} hopped through the colorful garden and discovered a magical {object} that sparkled in the sunshine. The {object} felt warm and special in the animal's tiny paws.",
        gradeLevel: 'K-2',
        category: 'adventure',
      },
      {
        template:
          'On a bright sunny day, a friendly {animal} met a new friend by the pond. Together they found a mysterious {object} floating near the lily pads.',
        gradeLevel: 'K-2',
        category: 'friendship',
      },
      {
        template:
          'The brave little {animal} heard a gentle voice calling from the enchanted forest. Following the sound, it discovered a beautiful {object} nestled among the wildflowers.',
        gradeLevel: 'K-2',
        category: 'courage',
      },

      // 3-5 Grade Level - Multiple variations per theme
      {
        template:
          "Maya's heart raced as she stared at her bedroom window, where impossible purple flowers were blooming right through the glass. The seeds from her great-grandmother's mysterious garden box weren't just growing—they were transforming her ordinary room into something magical.",
        gradeLevel: '3-5',
        category: 'mystery',
      },
      {
        template:
          "Alex discovered that the old music box in the attic wasn't just playing melodies—it was creating doorways to different worlds. Each song transported the curious student to a place where anything was possible.",
        gradeLevel: '3-5',
        category: 'adventure',
      },
      {
        template:
          "The school's new substitute teacher had an unusual secret: every story she told came to life in the classroom. When she began reading about brave explorers, the students found themselves on an incredible journey.",
        gradeLevel: '3-5',
        category: 'education',
      },
      {
        template:
          "Sam's pet {animal} started acting strangely after the thunderstorm, almost as if it could understand human language. When Sam discovered the animal could actually communicate, their friendship changed forever.",
        gradeLevel: '3-5',
        category: 'friendship',
      },

      // 6-8 Grade Level - Multiple variations per theme
      {
        template:
          "The leather-bound journal Marcus discovered wedged behind the astronomy section contained handwritten coordinates and a cryptic warning. As midnight approached, Marcus realized the coordinates pointed to a location that shouldn't exist on any map.",
        gradeLevel: '6-8',
        category: 'mystery',
      },
      {
        template:
          "Zara's smartphone began receiving text messages from someone claiming to be her future self, warning about decisions she hadn't made yet. Each message revealed consequences that would reshape everything she thought she knew about her life.",
        gradeLevel: '6-8',
        category: 'science-fiction',
      },
      {
        template:
          "The art studio's newest painting seemed to change whenever nobody was looking, depicting scenes from a world that existed only in the artist's imagination. When students began disappearing into the painting, Emma realized she had to find a way to bring them back.",
        gradeLevel: '6-8',
        category: 'fantasy',
      },
      {
        template:
          "Jordan's research project on local history uncovered evidence of a cover-up that had been hidden for decades. The deeper Jordan dug, the more dangerous the truth became—and the more people wanted it to stay buried.",
        gradeLevel: '6-8',
        category: 'thriller',
      },

      // 9-12 Grade Level - Multiple variations per theme
      {
        template:
          "The decision that would alter the trajectory of Elena's entire future arrived not as a dramatic moment, but disguised as an ordinary text message from an unknown number. Standing at the crossroads between her carefully planned life and the unknown, Elena had exactly thirty minutes to choose.",
        gradeLevel: '9-12',
        category: 'coming-of-age',
      },
      {
        template:
          "The college acceptance letter that changed everything wasn't the one Kai had been expecting—it was an invitation to a university that didn't officially exist. As Kai researched further, the line between reality and possibility began to blur in ways that challenged everything about identity and potential.",
        gradeLevel: '9-12',
        category: 'philosophical',
      },
      {
        template:
          'On the night before graduation, Reese discovered that every choice made in high school had been carefully orchestrated by an algorithm designed to predict student futures. Now faced with evidence of this manipulation, Reese had to decide whether to expose the truth or play along with a system that might actually be helping.',
        gradeLevel: '9-12',
        category: 'dystopian',
      },
      {
        template:
          "The internship at the cutting-edge research facility seemed like the perfect opportunity until Morgan realized the experiments being conducted there weren't just studying human behavior—they were attempting to control it. With limited time and resources, Morgan had to find a way to escape while exposing the truth.",
        gradeLevel: '9-12',
        category: 'sci-fi-thriller',
      },
    ];
  }

  public async generateStory(request: StoryRequest): Promise<StoryResponse> {
    try {
      // DIAGNOSTIC LOGGING: Track story length at generation entry point
      console.log('📊 [STORY GENERATION] Request received:', {
        gradeLevel: request.gradeLevel,
        hasStorySoFar: !!request.storySoFar,
        storySoFarLength: request.storySoFar?.length || 0,
        userInputLength: request.userInput?.length || 0,
        storyPreview:
          request.storySoFar?.substring(
            Math.max(0, (request.storySoFar?.length || 0) - 150),
          ) || 'N/A',
      });

      // Validate input
      const validationResult = this.validateRequest(request);
      if (!validationResult.isValid) {
        console.error('❌ [STORY GENERATION] Validation failed:', {
          violations: validationResult.violations,
          storySoFarLength: request.storySoFar?.length || 0,
          gradeLevel: request.gradeLevel,
        });
        return {
          story: '',
          success: false,
          error: `Validation failed: ${validationResult.violations.join(', ')}`,
          gradeLevel: request.gradeLevel,
        };
      }

      // Try OpenAI generation
      if (this.isOpenAIAvailable()) {
        console.log('🚀 Using OpenAI API for story generation');
        try {
          const story = await this.generateWithOpenAI(request);
          console.log('✅ [STORY GENERATION] OpenAI generation successful:', {
            storyLength: story.length,
            hasContent: !!story,
            inputContextLength: request.storySoFar?.length || 0,
            generatedPreview: story.substring(0, 100) + '...',
          });

          // Trigger post-generation element extraction and storage (async, non-blocking)
          this.triggerPostGenerationStorage(story, request);

          return {
            story,
            success: true,
            gradeLevel: request.gradeLevel,
            challenge: request.challenge,
          };
        } catch (error) {
          console.warn('❌ [STORY GENERATION] OpenAI generation failed:', {
            error: error instanceof Error ? error.message : String(error),
            storySoFarLength: request.storySoFar?.length || 0,
            gradeLevel: request.gradeLevel,
            willUseFallback: this.config.fallbackEnabled,
          });

          if (this.config.fallbackEnabled) {
            console.log(
              '⚠️ [STORY GENERATION] Using fallback due to OpenAI failure',
            );
            return this.generateFallbackStory(request);
          } else {
            throw error;
          }
        }
      }

      // Use fallback if OpenAI not available
      console.log(
        '🔄 [STORY GENERATION] OpenAI not available, using fallback templates',
      );
      if (this.config.fallbackEnabled) {
        return this.generateFallbackStory(request);
      }

      throw new Error('No OpenAI client available and fallback disabled');
    } catch (error) {
      return {
        story: '',
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
        gradeLevel: request.gradeLevel,
      };
    }
  }

  public async generateImportedStoryContinuation(
    importedStory: string,
    userInput: string,
    gradeLevel: GradeLevel,
    storyMetadata?: any,
  ): Promise<StoryResponse> {
    console.log('🎭 generateImportedStoryContinuation called', {
      gradeLevel,
      importedStoryLength: importedStory?.length || 0,
      userInputLength: userInput?.length || 0,
      hasMetadata: !!storyMetadata,
    });

    // Analyze the imported story structure and style
    const storyAnalysis = this.analyzeImportedStory(importedStory, gradeLevel);

    // Prepare enhanced context that includes style analysis
    const enhancedContext = this.prepareImportedStoryContext(
      importedStory,
      userInput,
      gradeLevel,
      storyAnalysis,
    );

    const request: StoryRequest = {
      storySoFar: importedStory,
      userInput: enhancedContext,
      gradeLevel,
      challenge: this.generateContinuationChallenge(storyAnalysis, gradeLevel),
    };

    console.log('📝 Generated enhanced continuation request', {
      contextLength: enhancedContext.length,
      challenge: request.challenge.substring(0, 100) + '...',
    });

    return this.generateStory(request);
  }

  public analyzeImportedStory(
    storyContent: string,
    gradeLevel: GradeLevel,
  ): StoryAnalysis {
    console.log('🔍 Analyzing imported story structure and style');

    const sentences = this.splitIntoSentences(storyContent);
    const words = storyContent.split(/\s+/);
    const avgWordsPerSentence = words.length / sentences.length;

    // Extract characters, settings, and themes
    const characters = this.extractCharacters(storyContent);
    const settings = this.extractSettings(storyContent);
    const themes = this.extractThemes(storyContent);
    const tense = this.detectTense(storyContent);
    const genre = this.detectGenre(storyContent);
    const tone = this.detectTone(storyContent);

    const analysis: StoryAnalysis = {
      wordCount: words.length,
      sentenceCount: sentences.length,
      avgWordsPerSentence,
      characters,
      settings,
      themes,
      tense,
      genre,
      tone,
      complexity: this.assessComplexity(avgWordsPerSentence, gradeLevel),
      style: this.analyzeWritingStyle(storyContent),
    };

    console.log('📊 Story analysis complete:', {
      wordCount: analysis.wordCount,
      sentenceCount: analysis.sentenceCount,
      characters: analysis.characters.length,
      genre: analysis.genre,
      tone: analysis.tone,
      complexity: analysis.complexity,
    });

    return analysis;
  }

  public prepareImportedStoryContext(
    importedStory: string,
    userInput: string,
    gradeLevel: GradeLevel,
    analysis: StoryAnalysis,
  ): string {
    console.log('🎨 Preparing imported story context for continuation');

    let context = `Continue this ${analysis.genre} story that has been imported. `;

    // Include style guidance based on analysis
    if (analysis.tone) {
      context += `Maintain the ${analysis.tone} tone established in the original. `;
    }

    if (analysis.tense) {
      context += `Continue in ${analysis.tense} tense as established. `;
    }

    // Character consistency
    if (analysis.characters.length > 0) {
      context += `Continue featuring these characters: ${analysis.characters.join(
        ', ',
      )}. `;
    }

    // Setting consistency
    if (analysis.settings.length > 0) {
      context += `Stay within the established settings: ${analysis.settings.join(
        ', ',
      )}. `;
    }

    // Theme consistency
    if (analysis.themes.length > 0) {
      context += `Continue exploring themes of: ${analysis.themes.join(
        ', ',
      )}. `;
    }

    // Writing style guidance
    context += `Match the writing style: ${analysis.style.description}. `;

    // Grade level appropriateness
    context += `Ensure continuation is appropriate for ${gradeLevel} readers. `;

    // Include user input
    if (userInput && userInput.trim()) {
      context += `\n\nIncorporate this user input naturally: "${userInput.trim()}"`;
    }

    console.log('✨ Context prepared:', {
      contextLength: context.length,
      preview: context.substring(0, 150) + '...',
    });

    return context;
  }

  private generateContinuationChallenge(
    analysis: StoryAnalysis,
    gradeLevel: GradeLevel,
  ): string {
    const baseChallenge = `Create a seamless continuation that maintains the ${analysis.genre} genre`;

    let challenge = baseChallenge;

    if (analysis.tone) {
      challenge += ` and ${analysis.tone} tone`;
    }

    challenge += `. Continue with the same writing style complexity level (${analysis.complexity}).`;

    // Add grade-specific continuation guidance
    const gradeGuidance = {
      'K-2':
        'Use simple, clear language with concrete imagery that young readers can visualize.',
      '3-5': 'Include engaging plot development with problem-solving elements.',
      '6-8':
        'Develop character emotions and include age-appropriate challenges.',
      '9-12': 'Explore deeper themes and complex character development.',
    };

    challenge += ` ${gradeGuidance[gradeLevel]}`;

    return challenge;
  }

  private extractCharacters(storyContent: string): string[] {
    const characters = new Set<string>();
    const content = storyContent.toLowerCase();

    // Common name patterns
    const namePattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g;
    const matches = storyContent.match(namePattern) || [];

    // Filter for likely character names (not common nouns)
    const commonNouns = [
      'The',
      'This',
      'That',
      'Once',
      'Then',
      'Now',
      'But',
      'And',
      'Or',
    ];

    matches.forEach(name => {
      if (!commonNouns.includes(name) && name.length > 2) {
        characters.add(name);
      }
    });

    // Also check for pronouns that suggest characters
    if (
      content.includes(' he ') ||
      content.includes(' him ') ||
      content.includes(' his ')
    ) {
      characters.add('male character');
    }
    if (
      content.includes(' she ') ||
      content.includes(' her ') ||
      content.includes(' hers ')
    ) {
      characters.add('female character');
    }

    return Array.from(characters).slice(0, 5); // Limit to most relevant
  }

  private extractSettings(storyContent: string): string[] {
    const settings = new Set<string>();
    const content = storyContent.toLowerCase();

    // Common setting indicators
    const settingWords = [
      'forest',
      'school',
      'home',
      'house',
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
      'classroom',
      'hospital',
      'restaurant',
      'shop',
      'farm',
      'lake',
      'river',
      'island',
      'cave',
      'tower',
      'building',
      'street',
      'field',
      'valley',
    ];

    settingWords.forEach(setting => {
      if (content.includes(setting)) {
        settings.add(setting);
      }
    });

    return Array.from(settings).slice(0, 3);
  }

  private extractThemes(storyContent: string): string[] {
    const themes = new Set<string>();
    const content = storyContent.toLowerCase();

    // Theme indicators
    const themeMap = {
      friendship: ['friend', 'friendship', 'together', 'help', 'support'],
      adventure: ['adventure', 'explore', 'journey', 'quest', 'discover'],
      mystery: ['mystery', 'secret', 'hidden', 'clue', 'solve'],
      magic: ['magic', 'magical', 'spell', 'wizard', 'fairy', 'enchanted'],
      family: [
        'family',
        'mother',
        'father',
        'parent',
        'sibling',
        'brother',
        'sister',
      ],
      courage: ['brave', 'courage', 'fear', 'scared', 'overcome'],
      learning: ['learn', 'school', 'teach', 'discover', 'understand'],
    };

    Object.entries(themeMap).forEach(([theme, keywords]) => {
      if (keywords.some(keyword => content.includes(keyword))) {
        themes.add(theme);
      }
    });

    return Array.from(themes).slice(0, 3);
  }

  private detectTense(storyContent: string): 'past' | 'present' | 'future' {
    const content = storyContent.toLowerCase();

    const pastIndicators = [
      'was',
      'were',
      'had',
      'did',
      'went',
      'said',
      'looked',
      'walked',
      'came',
      'left',
    ];
    const presentIndicators = [
      'is',
      'are',
      'has',
      'do',
      'go',
      'says',
      'looks',
      'walks',
      'comes',
      'leaves',
    ];
    const futureIndicators = ['will', 'shall', 'going to', 'gonna'];

    const pastCount = pastIndicators.filter(word =>
      content.includes(` ${word} `),
    ).length;
    const presentCount = presentIndicators.filter(word =>
      content.includes(` ${word} `),
    ).length;
    const futureCount = futureIndicators.filter(word =>
      content.includes(word),
    ).length;

    if (pastCount > presentCount && pastCount > futureCount) return 'past';
    if (futureCount > presentCount) return 'future';
    return 'present';
  }

  private detectGenre(storyContent: string): string {
    const content = storyContent.toLowerCase();

    const genreKeywords = {
      fantasy: [
        'magic',
        'wizard',
        'fairy',
        'dragon',
        'spell',
        'enchanted',
        'magical',
      ],
      mystery: ['mystery', 'clue', 'solve', 'detective', 'secret', 'hidden'],
      adventure: [
        'adventure',
        'journey',
        'quest',
        'explore',
        'treasure',
        'danger',
      ],
      scifi: ['robot', 'space', 'alien', 'future', 'technology', 'computer'],
      realistic: ['school', 'home', 'family', 'friend', 'everyday'],
    };

    let maxScore = 0;
    let detectedGenre = 'realistic';

    Object.entries(genreKeywords).forEach(([genre, keywords]) => {
      const score = keywords.filter(keyword =>
        content.includes(keyword),
      ).length;
      if (score > maxScore) {
        maxScore = score;
        detectedGenre = genre;
      }
    });

    return detectedGenre;
  }

  private detectTone(storyContent: string): string {
    const content = storyContent.toLowerCase();

    const toneKeywords = {
      cheerful: [
        'happy',
        'joy',
        'smile',
        'laugh',
        'bright',
        'cheerful',
        'excited',
      ],
      serious: ['important', 'careful', 'serious', 'worried', 'concerned'],
      mysterious: ['dark', 'shadow', 'whisper', 'quiet', 'strange', 'eerie'],
      playful: ['fun', 'play', 'silly', 'giggle', 'bounce', 'skip'],
      calm: ['peaceful', 'gentle', 'soft', 'quiet', 'serene', 'tranquil'],
    };

    let maxScore = 0;
    let detectedTone = 'neutral';

    Object.entries(toneKeywords).forEach(([tone, keywords]) => {
      const score = keywords.filter(keyword =>
        content.includes(keyword),
      ).length;
      if (score > maxScore) {
        maxScore = score;
        detectedTone = tone;
      }
    });

    return detectedTone;
  }

  private assessComplexity(
    avgWordsPerSentence: number,
    gradeLevel: GradeLevel,
  ): string {
    const gradeLimits = {
      'K-2': 12,
      '3-5': 16,
      '6-8': 20,
      '9-12': 25,
    };

    const limit = gradeLimits[gradeLevel];

    if (avgWordsPerSentence <= limit) return 'appropriate';
    if (avgWordsPerSentence <= limit * 1.2) return 'slightly complex';
    return 'complex';
  }

  private analyzeWritingStyle(storyContent: string): {
    description: string;
    features: string[];
  } {
    const features = [];
    const content = storyContent.toLowerCase();

    // Analyze sentence variety
    const sentences = this.splitIntoSentences(storyContent);
    const avgLength =
      sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length;

    if (avgLength < 50) features.push('concise sentences');
    else if (avgLength > 100) features.push('detailed descriptions');

    // Check for dialogue
    if (storyContent.includes('"') || storyContent.includes("'")) {
      features.push('includes dialogue');
    }

    // Check for descriptive language
    const descriptiveWords = [
      'beautiful',
      'amazing',
      'wonderful',
      'mysterious',
      'bright',
      'dark',
      'loud',
      'quiet',
    ];
    if (descriptiveWords.some(word => content.includes(word))) {
      features.push('descriptive language');
    }

    // Check for action words
    const actionWords = [
      'ran',
      'jumped',
      'flew',
      'climbed',
      'rushed',
      'hurried',
    ];
    if (actionWords.some(word => content.includes(word))) {
      features.push('action-oriented');
    }

    const description =
      features.length > 0
        ? `Uses ${features.join(', ')}`
        : 'Simple narrative style';

    return { description, features };
  }

  private async generateWithOpenAI(request: StoryRequest): Promise<string> {
    if (!openaiClient.isConfigured()) {
      throw new Error('OpenAI client not configured');
    }

    const { systemPrompt, userPrompt } = await this.buildPrompts(request);

    console.log('📝 Generating with OpenAI:', {
      systemPromptLength: systemPrompt.length,
      userPromptLength: userPrompt.length,
      model: this.config.model,
    });

    const content = await openaiClient.generateStoryCompletion(
      systemPrompt,
      userPrompt,
      {
        model: this.config.model,
        maxTokens: this.config.maxTokens,
        temperature: this.config.temperature,
        // Use stop sequences for story generation to prevent overly long responses
        stop: ['\n\n', '###'],
      },
    );

    // Apply content filtering and sentence limiting
    console.log('📝 OpenAI generated content:', {
      contentLength: content.length,
      contentPreview: content.substring(0, 200) + '...',
    });

    const filteredContent = this.filterAndLimitContent(
      content,
      request.gradeLevel,
    );

    if (!filteredContent.isValid) {
      // Check if violations are only about complexity (not inappropriate content)
      const hasInappropriateWords = filteredContent.violations.some(v =>
        v.includes('inappropriate word'),
      );

      if (hasInappropriateWords) {
        console.warn(
          '❌ Blocking content for inappropriate words:',
          filteredContent.violations,
        );
        throw new Error(
          `Content filter violations: ${filteredContent.violations.join(', ')}`,
        );
      } else {
        // Allow content with complexity warnings - OpenAI handles age-appropriateness
        console.log('✅ OpenAI content approved (complexity warnings ignored)');
        return content; // Return original content if only complexity violations
      }
    }

    return filteredContent.filteredContent || content;
  }

  /**
   * Retrieves diversity guidance for a story generation request
   * Non-blocking: Returns empty string on error to allow story generation to continue
   */
  private async getDiversityGuidance(request: StoryRequest): Promise<string> {
    return diversityPerformanceMonitoringService.measureAsync({
      operation: 'diversity_guidance',
      sessionId: request.sessionId,
      storyId: request.storyId,
      fn: async () => {
        try {
          console.log('🎨 Retrieving diversity guidance', {
            sessionId: request.sessionId,
            userId: request.userId,
            gradeLevel: request.gradeLevel,
          });

          // Step 1: Get or create session
          let sessionId = request.sessionId;
          if (!sessionId && request.userId) {
            // Create session from userId if no sessionId provided
            const sessionResult = await getOrCreateSessionWithAuth();
            sessionId = sessionResult.id;
            console.log('✅ Created/retrieved session:', sessionId);
          }

          if (!sessionId) {
            console.log(
              '⚠️ No session context available, skipping diversity guidance',
            );
            return '';
          }

          // Step 2: Retrieve recent elements for this session
          const recentElements = await recentElementsService.getRecentElements({
            sessionId,
            limit: 10, // Last 10 stories
          });

          console.log('📚 Retrieved recent elements:', {
            totalElements:
              recentElementsService.getTotalElementCount(recentElements),
            characterCount: recentElements.characters.length,
            settingCount: recentElements.settings.length,
            objectCount: recentElements.objects.length,
            plotPatternCount: recentElements.plot_patterns.length,
          });

          // Step 3: Generate diversity guidance from recent elements
          const guidance = diversityGuidanceService.generateDiversityGuidance({
            recentElements,
            maxElementsToList: 5,
            includeAlternatives: true,
            emphasisLevel: 'moderate',
          });

          if (!guidance.hasGuidance) {
            console.log(
              '✨ No diversity guidance needed (no repeated elements)',
            );
            return '';
          }

          console.log('🎯 Generated diversity guidance:', {
            avoidedElementsCount: guidance.avoidedElementsCount,
            suggestedAlternativesCount: guidance.suggestedAlternativesCount,
            guidanceLength: guidance.guidanceText.length,
            guidancePreview: guidance.guidanceText.substring(0, 150) + '...',
          });

          return guidance.guidanceText;
        } catch (error) {
          console.error('❌ Error retrieving diversity guidance:', error);
          // Non-blocking: return empty string to allow story generation to continue
          return '';
        }
      },
    });
  }

  /**
   * Trigger post-generation element extraction and storage (async, non-blocking)
   *
   * This method fires off the extraction and storage process after successful
   * story generation. It runs asynchronously and does not block story delivery.
   * Failures are logged but do not affect the user experience.
   *
   * @param storyText - The generated story text
   * @param request - The original story request with session/story IDs
   */
  private triggerPostGenerationStorage(
    storyText: string,
    request: StoryRequest,
  ): void {
    // Require both sessionId and storyId for storage
    if (!request.sessionId || !request.storyId) {
      console.log(
        '⚠️ Skipping post-generation storage: missing sessionId or storyId',
        {
          hasSessionId: !!request.sessionId,
          hasStoryId: !!request.storyId,
        },
      );
      return;
    }

    console.log(
      '🚀 Triggering post-generation element extraction and storage',
      {
        sessionId: request.sessionId,
        storyId: request.storyId,
        storyLength: storyText.length,
      },
    );

    // Fire and forget - async processing that doesn't block story delivery
    postGenerationStorageService.extractAndStoreElementsAsync({
      storyText,
      storyId: request.storyId,
      sessionId: request.sessionId,
    });
  }

  private async buildPrompts(request: StoryRequest): Promise<{
    systemPrompt: string;
    userPrompt: string;
  }> {
    const agent = request.storySoFar
      ? this.agents.story_partner
      : this.agents.creative_writer;

    // Retrieve diversity guidance if session context is available
    let diversityGuidance = '';
    if (request.sessionId || request.userId) {
      try {
        diversityGuidance = await this.getDiversityGuidance(request);
      } catch (error) {
        // Non-blocking: log error but continue story generation
        console.warn(
          '⚠️ Failed to retrieve diversity guidance, continuing without it:',
          error,
        );
      }
    }

    const systemPrompt = this.buildSystemPrompt(
      agent,
      request.gradeLevel,
      diversityGuidance,
      request.genre,
    );
    const userPrompt = this.buildUserPrompt(request);

    return { systemPrompt, userPrompt };
  }

  /**
   * Genre-specific writing guidance for the AI system prompt.
   * Horror entries are grade-aware: K-2 gets "spooky and silly", 3-5 gets "mild suspense",
   * while older grades get progressively more atmospheric Horror guidance.
   */
  private getGenreGuidance(genre: string, gradeLevel: GradeLevel): string {
    const genreGuidanceMap: Record<string, string> = {
      Mystery:
        'Write in a mystery style. Include clues, secrets, and puzzles for the reader to follow. Build suspense through unanswered questions and surprising discoveries. Use foreshadowing and red herrings appropriate for the reading level.',
      Fantasy:
        'Write in a fantasy style. Include magical elements, enchanted settings, and wondrous creatures. Create a sense of wonder and imagination. Use vivid descriptions of fantastical worlds and extraordinary abilities.',
      Comedy:
        'Write in a comedic style. Include humor through funny situations, witty dialogue, and amusing character traits. Use wordplay, unexpected twists, and lighthearted moments to make the reader laugh.',
      Horror: this.getHorrorGuidance(gradeLevel),
      Fiction:
        'Write in a realistic fiction style. Focus on believable characters, relatable situations, and authentic emotions. Ground the story in everyday life while making it compelling and meaningful.',
      'Fairy Tale':
        'Write in a fairy tale style. Use classic storytelling patterns with magical transformations, moral lessons, and enchanted objects. Include phrases like "once upon a time" and create a timeless, storybook atmosphere.',
    };

    return genreGuidanceMap[genre] || '';
  }

  private getHorrorGuidance(gradeLevel: GradeLevel): string {
    switch (gradeLevel) {
      case 'K-2':
        return 'Write in a spooky and silly style. Include playful surprises like friendly ghosts, silly monsters, and things that go bump in the night. Keep the tone light, fun, and giggle-worthy. Everything should feel safe and gentle.';
      case '3-5':
        return 'Write with mild suspense and mystery. Include slightly eerie settings and curious unexplained events, but keep the tone adventurous. Focus on brave characters solving spooky puzzles. Keep everything age-appropriate and gentle.';
      case '6-8':
        return 'Write in a suspenseful, atmospheric style. Include eerie settings, mysterious events, and building tension. Create a sense of unease through the unknown, but keep content age-appropriate. Focus on atmosphere and mystery over graphic content.';
      case '9-12':
        return 'Write in a horror style with atmospheric tension, psychological suspense, and eerie settings. Build dread through pacing, foreshadowing, and the unknown. Focus on psychological horror and atmosphere rather than graphic content.';
      default:
        return 'Write with mild suspense and mystery. Include eerie settings and curious unexplained events.';
    }
  }

  private buildSystemPrompt(
    agent: AgentConfig,
    gradeLevel: GradeLevel,
    diversityGuidance: string = '',
    genre?: string,
  ): string {
    // Grade-specific vocabulary guidance
    const vocabularyGuidance = {
      'K-2':
        'Use simple, common words that kindergarten through 2nd grade students can read. Avoid complex words like "nestled", "whispering", "stumbled". Use words like "found", "saw", "went", "happy", "big", "little". Keep sentences short and clear.',
      '3-5':
        'Use vocabulary appropriate for 3rd-5th grade reading level. Include some descriptive words but keep language accessible.',
      '6-8':
        'Use age-appropriate vocabulary for middle school students with some challenging words.',
      '9-12':
        'Use sophisticated vocabulary appropriate for high school students.',
    };

    let systemPrompt = `You are a creative children's story writer who creates unique, engaging stories with diverse characters and settings. Avoid repetitive themes and always create something fresh and original.

You specialize in writing for ${gradeLevel} students. Your stories should be age-appropriate, engaging, and educational.

VOCABULARY REQUIREMENTS FOR ${gradeLevel}:
${vocabularyGuidance[gradeLevel]}`;

    // Insert genre-specific guidance between vocabulary requirements and key guidelines
    if (genre) {
      const genreGuidance = this.getGenreGuidance(genre, gradeLevel);
      if (genreGuidance) {
        systemPrompt += `\n\nGENRE: ${genre}\n${genreGuidance}`;
      }
    }

    systemPrompt += `\n\nKey guidelines:
- Write 2-3 sentences that flow naturally
- Keep sentences short and simple for young readers
- If continuing a story, maintain the same characters, setting, and tone
- Build on what the student has written without changing their creative direction
- Use familiar, everyday words that ${gradeLevel} students know`;

    // Append diversity guidance if available
    if (diversityGuidance) {
      systemPrompt += `\n\n${diversityGuidance}`;
    }

    return systemPrompt;
  }

  private getGradeGuidelines(gradeLevel: GradeLevel): string {
    const guidelines = {
      'K-2': `
      • Vocabulary: 500-1000 sight words, simple nouns, basic adjectives
      • Sentence Structure: 3-8 words per sentence, subject-verb-object patterns
      • Themes: Friendship, family, animals, basic emotions, discovery
      • Literary Elements: Simple cause/effect, basic character feelings
      • Educational Goals: Letter recognition, phonics, basic reading fluency
      • Emotional Development: Empathy, sharing, kindness, curiosity
      • Examples: "The cat sat on the mat." / "Emma found a shiny red ball."`,

      '3-5': `
      • Vocabulary: 2000-3000 words, descriptive adjectives, action verbs
      • Sentence Structure: 8-15 words, compound sentences, basic conjunctions
      • Themes: Problem-solving, teamwork, overcoming challenges, learning
      • Literary Elements: Character motivation, setting description, plot development
      • Educational Goals: Reading comprehension, critical thinking, vocabulary building
      • Emotional Development: Responsibility, perseverance, friendship dynamics
      • Examples: "Maya discovered the ancient map hidden in her grandmother's attic, and she knew her summer adventure was about to begin."`,

      '6-8': `
      • Vocabulary: 4000-6000 words, complex descriptive language, figurative speech
      • Sentence Structure: 12-20 words, complex sentences, varied syntax
      • Themes: Identity, belonging, moral choices, personal growth, relationships
      • Literary Elements: Character development, symbolism, conflict resolution
      • Educational Goals: Advanced comprehension, analytical thinking, creative expression
      • Emotional Development: Self-awareness, empathy, ethical reasoning
      • Examples: "As thunder echoed through the ancient library, Marcus realized that the mysterious book he'd discovered wasn't just telling stories—it was somehow rewriting reality itself."`,

      '9-12': `
      • Vocabulary: 6000+ words, sophisticated terminology, nuanced expression
      • Sentence Structure: 15-25 words, complex syntax, literary devices
      • Themes: Philosophical questions, social issues, psychological complexity, coming-of-age
      • Literary Elements: Advanced symbolism, multiple perspectives, thematic depth
      • Educational Goals: Critical analysis, abstract thinking, literary appreciation
      • Emotional Development: Complex relationships, moral reasoning, future planning
      • Examples: "The decision that would alter the trajectory of her entire life arrived not with fanfare or obvious significance, but disguised as an ordinary Tuesday morning email that she almost deleted without reading."`,
    };

    return guidelines[gradeLevel];
  }

  private buildUserPrompt(request: StoryRequest): string {
    // Use Story_Quest's simple and effective approach
    if (request.storySoFar) {
      // Story continuation - Story_Quest style
      const simplicityGuidance =
        request.gradeLevel === 'K-2'
          ? 'Use very simple words and short sentences that kindergarten and early elementary students can understand easily.'
          : '';

      // Genre reinforcement for continuations
      const genreGuidance = request.genre
        ? `Maintain the ${request.genre} genre throughout.`
        : '';

      // For long stories, send only the recent context to avoid wasting tokens.
      // The AI only needs recent narrative to produce a coherent continuation.
      const MAX_CONTEXT_CHARS = 8000;
      const storyContext =
        request.storySoFar.length > MAX_CONTEXT_CHARS
          ? '...' +
            request.storySoFar.substring(
              request.storySoFar.length - MAX_CONTEXT_CHARS,
            )
          : request.storySoFar;

      return `Continue this story in a creative and engaging way. The story is for ${
        request.gradeLevel
      } students.
Story so far: ${storyContext}
${request.challenge ? `Current challenge: ${request.challenge}` : ''}
${simplicityGuidance}
${genreGuidance}

Continue the story with 1-3 sentences. Keep your response under 200 words.`;
    } else {
      // Story starter
      let prompt = `Create an engaging story opening that will captivate young readers and inspire them to continue writing.\n\n`;
      prompt += `Your story should:\n`;
      prompt += `- Introduce an intriguing character or situation\n`;
      prompt += `- Establish a vivid, specific setting\n`;
      prompt += `- Create immediate engagement through conflict, mystery, or discovery\n`;
      prompt += `- Use rich sensory details appropriate for the grade level\n`;
      prompt += `- End with a compelling hook that encourages continuation\n\n`;

      if (request.userInput) {
        prompt += `STUDENT CREATIVE INPUT TO INCORPORATE:\n"${request.userInput}"\n\n`;
        prompt += `Weave this student input naturally into your story opening.\n\n`;
      }

      if (request.challenge) {
        prompt += `CREATIVE WRITING CHALLENGE:\n${request.challenge}\n\n`;
        prompt += `Incorporate this challenge seamlessly into your narrative.\n\n`;
      }

      // Genre requirement for story starters
      if (request.genre) {
        prompt += `GENRE REQUIREMENT:\nThis story must be written in the ${request.genre} genre. Ensure the opening sets the appropriate tone, atmosphere, and narrative elements characteristic of ${request.genre} stories.\n\n`;
      }

      const finalGuidance =
        request.gradeLevel === 'K-2'
          ? 'Write 2-3 SHORT, SIMPLE sentences using easy words that kindergarten and 1st-2nd grade students can read.'
          : 'Compose exactly 2-3 sentences that begin a new story with creativity and educational value appropriate for the specified grade level.';

      prompt += `FINAL INSTRUCTION:\n${finalGuidance}`;

      return prompt;
    }
  }

  private filterAndLimitContent(
    content: string,
    gradeLevel: GradeLevel,
  ): ContentValidationResult {
    const violations: string[] = [];
    let filteredContent = content;

    // Check for inappropriate words using word boundaries to avoid false positives
    // e.g., "war" should not match "warm", "aware", "award"
    const lowerContent = content.toLowerCase();
    for (const word of this.config.contentFilter.inappropriateWords) {
      // Use word boundary regex to match whole words only
      const wordRegex = new RegExp(`\\b${word.toLowerCase()}\\b`, 'i');
      if (wordRegex.test(content)) {
        violations.push(`Contains inappropriate word: ${word}`);
      }
    }

    // Limit sentences
    const sentences = this.splitIntoSentences(filteredContent);
    if (sentences.length > this.config.contentFilter.maxSentences) {
      filteredContent = sentences
        .slice(0, this.config.contentFilter.maxSentences)
        .join(' ');
    }

    if (sentences.length < this.config.contentFilter.minSentences) {
      violations.push('Content too short (less than 2 sentences)');
    }

    // Check sentence length for grade appropriateness (relaxed check)
    const averageWordsPerSentence =
      this.getAverageWordsPerSentence(filteredContent);
    const maxWordsForGrade = this.getMaxWordsPerSentence(gradeLevel);

    // Only flag if sentences are SIGNIFICANTLY too complex (50% over limit)
    if (averageWordsPerSentence > maxWordsForGrade * 1.5) {
      console.log('📊 Sentence complexity check:', {
        averageWordsPerSentence: Math.round(averageWordsPerSentence),
        limit: maxWordsForGrade,
        gradeLevel,
      });
      violations.push(
        `Sentences too complex for grade level ${gradeLevel} (${Math.round(
          averageWordsPerSentence,
        )} words avg, max ${maxWordsForGrade})`,
      );
    }

    return {
      isValid: violations.length === 0,
      violations,
      filteredContent: violations.length === 0 ? filteredContent : undefined,
    };
  }

  private splitIntoSentences(text: string): string[] {
    return text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  }

  private getAverageWordsPerSentence(text: string): number {
    const sentences = this.splitIntoSentences(text);
    const totalWords = text.split(/\s+/).length;
    return sentences.length > 0 ? totalWords / sentences.length : 0;
  }

  private getMaxWordsPerSentence(gradeLevel: GradeLevel): number {
    // Relaxed limits to match real children's books
    // Story_Quest doesn't filter sentence complexity - OpenAI handles age-appropriateness
    const limits = {
      'K-2': 18, // Increased from 10 - many children's books use longer sentences
      '3-5': 25, // Increased from 15
      '6-8': 30, // Increased from 20
      '9-12': 35, // Increased from 25
    };
    return limits[gradeLevel];
  }

  private validateRequest(request: StoryRequest): ContentValidationResult {
    const violations: string[] = [];

    if (!request.gradeLevel) {
      violations.push('Grade level is required');
    }

    if (request.userInput && request.userInput.length > 1000) {
      violations.push('User input too long (max 1000 characters)');
    }

    // No hard limit on storySoFar length — loaded/continued stories can
    // legitimately exceed earlier round-count assumptions. GPT-4 Turbo 128K
    // context handles large inputs, and buildUserPrompt truncates the context
    // sent to the API to keep only the most relevant recent text.

    // Skip validation of user input - it's just a prompt, not story content
    // Validation should only apply to generated story content, not input prompts

    return {
      isValid: violations.length === 0,
      violations,
    };
  }

  private generateFallbackStory(request: StoryRequest): StoryResponse {
    try {
      console.log('🎪 [FALLBACK] generateFallbackStory called', {
        gradeLevel: request.gradeLevel,
        hasStorySoFar: !!request.storySoFar,
        storySoFarLength: request.storySoFar?.length || 0,
        userInputLength: request.userInput?.length || 0,
        storyContextPreview: request.storySoFar
          ? request.storySoFar.substring(
              Math.max(0, request.storySoFar.length - 200),
            )
          : 'N/A',
      });

      if (request.storySoFar) {
        // Generate story continuation
        console.log('📖 [FALLBACK] Generating story continuation with context');
        return this.generateStoryContinuation(request);
      } else {
        // Generate story starter
        console.log('🌟 [FALLBACK] Generating story starter');
        return this.generateStoryStarter(request);
      }
    } catch (error) {
      return {
        story:
          'Once upon a time, something magical was about to happen. The adventure was just beginning.',
        success: true,
        gradeLevel: request.gradeLevel,
        error: 'Using basic fallback story',
      };
    }
  }

  private generateStoryStarter(request: StoryRequest): StoryResponse {
    console.log(
      '🎨 generateStoryStarter called with gradeLevel:',
      request.gradeLevel,
    );

    const fallbackOptions = this.fallbackStories.filter(
      f => f.gradeLevel === request.gradeLevel,
    );
    console.log(
      '📚 Available fallback options for grade level:',
      fallbackOptions.length,
    );

    // Prefer genre-matching categories when genre is set
    let selectedFallback: FallbackStory;
    if (request.genre && fallbackOptions.length > 0) {
      const genreCategoryMap: Record<string, string[]> = {
        Mystery: ['mystery', 'thriller'],
        Fantasy: ['fantasy', 'adventure'],
        Comedy: ['comedy', 'friendship'],
        Horror: ['thriller', 'mystery', 'dystopian'],
        Fiction: ['coming-of-age', 'friendship', 'education'],
        'Fairy Tale': ['fantasy', 'adventure', 'courage'],
      };
      const preferredCategories = genreCategoryMap[request.genre] || [];
      const genreMatches = fallbackOptions.filter(f =>
        preferredCategories.includes(f.category),
      );
      const pool = genreMatches.length > 0 ? genreMatches : fallbackOptions;
      selectedFallback =
        pool[Math.floor(Math.random() * pool.length)] ||
        this.fallbackStories[0];
    } else {
      selectedFallback =
        fallbackOptions[Math.floor(Math.random() * fallbackOptions.length)] ||
        this.fallbackStories[0];
    }
    console.log('🎲 Selected fallback category:', selectedFallback.category);

    let story = selectedFallback.template;

    // Template substitution with varied options
    story = story.replace(/{animal}/g, this.getRandomAnimal());
    story = story.replace(/{object}/g, this.getRandomObject());
    story = story.replace(/{character}/g, this.getRandomCharacterName());
    story = story.replace(/{setting}/g, this.getRandomSetting());

    console.log('✨ Generated story starter:', {
      preview: story.substring(0, 100) + '...',
      fullLength: story.length,
    });

    return {
      story,
      success: true,
      gradeLevel: request.gradeLevel,
      challenge: request.challenge,
    };
  }

  private generateStoryContinuation(request: StoryRequest): StoryResponse {
    // Use Story_Quest approach: analyze the complete story context for continuation
    const userInput = request.userInput || '';
    const storyContext = request.storySoFar || '';

    console.log('🔍 generateStoryContinuation DEBUG:', {
      userInputLength: userInput.length,
      userInputFirst100: userInput.substring(0, 100),
      storyContextLength: storyContext.length,
      storyContextLast100: storyContext.substring(
        Math.max(0, storyContext.length - 100),
      ),
    });

    // Extract the user's latest contribution from the story context
    // The userInput should be the user's latest addition
    const fullStoryForAnalysis = storyContext; // Use the complete story for context
    const userLatestContribution = userInput; // User's specific contribution

    // Generate contextual continuation based on the complete story and user's latest input
    const contextualContinuation = this.generateContextualContinuation(
      userLatestContribution,
      fullStoryForAnalysis,
      request.gradeLevel,
    );

    if (contextualContinuation) {
      return {
        story: contextualContinuation,
        success: true,
        gradeLevel: request.gradeLevel,
        challenge: request.challenge,
      };
    }

    // Fallback to template-based generation if contextual fails
    const continuationTemplates = this.getStoryContinuationTemplates();
    const gradeTemplates =
      continuationTemplates[request.gradeLevel] || continuationTemplates['K-2'];

    // Try to match story context for better continuations
    const storyLower = storyContext.toLowerCase();
    let selectedTemplates = gradeTemplates.general;

    // Match story themes for more coherent continuations
    if (
      storyLower.includes('magic') ||
      storyLower.includes('glow') ||
      storyLower.includes('shimmer')
    ) {
      selectedTemplates = gradeTemplates.magical || gradeTemplates.general;
    } else if (
      storyLower.includes('animal') ||
      storyLower.includes('rabbit') ||
      storyLower.includes('cat') ||
      storyLower.includes('dog')
    ) {
      selectedTemplates = gradeTemplates.animal || gradeTemplates.general;
    } else if (
      storyLower.includes('discover') ||
      storyLower.includes('found') ||
      storyLower.includes('hidden')
    ) {
      selectedTemplates = gradeTemplates.discovery || gradeTemplates.general;
    } else if (
      storyLower.includes('friend') ||
      storyLower.includes('together') ||
      storyLower.includes('meet')
    ) {
      selectedTemplates = gradeTemplates.friendship || gradeTemplates.general;
    }

    const randomTemplate =
      selectedTemplates[Math.floor(Math.random() * selectedTemplates.length)];
    let continuation = randomTemplate;

    // Template substitution
    continuation = continuation.replace(/{animal}/g, this.getRandomAnimal());
    continuation = continuation.replace(/{object}/g, this.getRandomObject());
    continuation = continuation.replace(
      /{character}/g,
      this.getRandomCharacterName(),
    );
    continuation = continuation.replace(/{setting}/g, this.getRandomSetting());
    continuation = continuation.replace(
      /{emotion}/g,
      this.getRandomEmotion(request.gradeLevel),
    );

    return {
      story: continuation,
      success: true,
      gradeLevel: request.gradeLevel,
      challenge: request.challenge,
    };
  }

  private getStoryContinuationTemplates(): Record<string, any> {
    return {
      'K-2': {
        general: [
          'The {animal} felt very {emotion} and decided to explore more.',
          'Suddenly, a beautiful {object} appeared in front of them.',
          'The {animal} heard a sweet sound coming from the {setting}.',
          'A new friend appeared and wanted to play together.',
          'The {animal} discovered something wonderful and exciting.',
        ],
        magical: [
          'The magic grew stronger and made everything sparkle.',
          "The {animal}'s special powers helped solve the problem.",
          'Magical lights danced around the {animal} happily.',
          'The enchanted {object} granted the {animal} a special wish.',
          'The magic created beautiful colors in the sky.',
        ],
        animal: [
          'The {animal} made friends with other animals in the forest.',
          'All the animals worked together to help each other.',
          'The {animal} taught the other animals a new game.',
          'The animals discovered a secret place to play.',
          'The {animal} showed kindness to a smaller creature.',
        ],
        discovery: [
          'They found a hidden path leading to somewhere special.',
          'The discovery led to an amazing new adventure.',
          'What they found was more wonderful than expected.',
          'The {object} they discovered had a special purpose.',
          'Their discovery helped other animals in the forest.',
        ],
        friendship: [
          'The new friends decided to help each other.',
          'Together they made the day more fun and special.',
          'The friends shared their favorite games and stories.',
          'They promised to always be kind to one another.',
          'The friendship made both of them feel happy.',
        ],
      },
      '3-5': {
        general: [
          'The discovery changed everything they thought they knew about the {setting}.',
          'As they ventured deeper, the mystery became more intriguing.',
          'The {character} realized this was just the beginning of their adventure.',
          'What happened next would test their courage and determination.',
          'The {object} held secrets that could help them on their journey.',
        ],
        magical: [
          'The magical forces grew stronger, responding to their emotions.',
          'They learned to control their newfound abilities with practice.',
          'The magic revealed hidden truths about their destiny.',
          'Ancient powers awakened, ready to guide them forward.',
          'The enchantment connected them to other magical beings.',
        ],
        animal: [
          'The {animal} demonstrated intelligence beyond what anyone expected.',
          'Communication between human and animal became clearer.',
          "The {animal}'s instincts led them toward important discoveries.",
          'Together they formed an unbreakable bond of trust.',
          'The {animal} revealed abilities that would prove crucial.',
        ],
        discovery: [
          'The investigation uncovered clues pointing to a larger mystery.',
          'Each discovery led to more questions that needed answers.',
          'What they found challenged everything they believed before.',
          'The evidence suggested something extraordinary was happening.',
          "Their research revealed connections they hadn't considered.",
        ],
        friendship: [
          'The friendship was tested but emerged stronger than before.',
          'Working together, they accomplished more than either could alone.',
          'They learned important lessons about trust and loyalty.',
          'The bond between them gave them strength to face challenges.',
          'Their friendship inspired others to work together too.',
        ],
      },
      '6-8': {
        general: [
          'The complexity of the situation became apparent as new information emerged.',
          'Their understanding of the circumstances shifted dramatically with this revelation.',
          "The implications of what they'd discovered would affect everyone involved.",
          'As the truth unfolded, they realized they faced a critical decision.',
          'The events that followed would challenge their assumptions about reality.',
        ],
        magical: [
          'The magical systems operating in their world proved more intricate than imagined.',
          'They discovered their connection to ancient powers carried both gifts and responsibilities.',
          'The supernatural forces at work required careful understanding and respect.',
          'Magic became a tool for growth rather than an escape from problems.',
          'The mystical elements of their journey reflected deeper truths about themselves.',
        ],
        discovery: [
          'The investigation revealed layers of complexity that demanded careful analysis.',
          'Evidence pointed toward conclusions that challenged conventional wisdom.',
          'What they uncovered had implications reaching far beyond their immediate situation.',
          'The research led them to question fundamental assumptions about their world.',
          'Their discoveries connected seemingly unrelated events in surprising ways.',
        ],
        friendship: [
          'The relationship evolved as they faced challenges that tested their values.',
          'They learned that true friendship required both support and honest confrontation.',
          'The bond between them became a source of strength during difficult times.',
          'Their friendship provided perspective that helped them navigate complex situations.',
          'Together they discovered capabilities they never knew they possessed.',
        ],
      },
      '9-12': {
        general: [
          'The philosophical implications of their situation demanded careful consideration of ethics and consequence.',
          'As perspectives shifted, they grappled with questions that had no easy answers.',
          'The experience forced them to confront fundamental assumptions about identity and purpose.',
          'What emerged from this challenge would define their understanding of personal responsibility.',
          'The complexity of human nature revealed itself through the decisions they now faced.',
        ],
        discovery: [
          'The research unveiled systemic issues that challenged institutional narratives.',
          'Evidence suggested that accepted truths might be incomplete or deliberately obscured.',
          'Their investigation revealed how individual actions could have far-reaching consequences.',
          'The discoveries forced them to reconsider their role in larger social structures.',
          'What they learned illuminated the intersection between personal choice and collective responsibility.',
        ],
        friendship: [
          'The relationship evolved into a partnership that transcended conventional boundaries.',
          'They discovered that authentic connection required vulnerability and mutual respect.',
          'Their bond became a foundation for navigating the complexities of adult relationships.',
          'The friendship challenged them to grow while maintaining their individual identities.',
          'Together they learned that support sometimes meant accepting difficult truths.',
        ],
      },
    };
  }

  private getRandomAnimal(): string {
    const animals = [
      'rabbit',
      'squirrel',
      'bird',
      'fox',
      'deer',
      'butterfly',
      'cat',
      'dog',
      'owl',
      'mouse',
      'hedgehog',
      'turtle',
    ];
    return animals[Math.floor(Math.random() * animals.length)];
  }

  private getRandomObject(): string {
    const objects = [
      'crystal',
      'book',
      'key',
      'compass',
      'stone',
      'feather',
      'bell',
      'star',
      'flower',
      'shell',
      'gem',
      'map',
    ];
    return objects[Math.floor(Math.random() * objects.length)];
  }

  private getRandomCharacterName(): string {
    const names = [
      'Alex',
      'Maya',
      'Sam',
      'Jordan',
      'Taylor',
      'Casey',
      'Riley',
      'Morgan',
      'Avery',
      'Quinn',
      'Sage',
      'River',
    ];
    return names[Math.floor(Math.random() * names.length)];
  }

  private getRandomSetting(): string {
    const settings = [
      'forest',
      'garden',
      'meadow',
      'library',
      'classroom',
      'park',
      'beach',
      'mountain',
      'cave',
      'bridge',
      'tower',
      'village',
    ];
    return settings[Math.floor(Math.random() * settings.length)];
  }

  private generateContextualContinuation(
    userInput: string,
    storyContext: string,
    gradeLevel: GradeLevel,
  ): string | null {
    if (!userInput || userInput.length < 10) return null;

    const inputLower = userInput.toLowerCase();
    const contextLower = storyContext.toLowerCase();
    const fullContext = contextLower + ' ' + inputLower;

    // Enhanced character extraction to handle complex names and descriptions
    // Look for capitalized names that appear as subjects in the story
    const characterMatches = fullContext.match(
      /\b([A-Z][a-z]+)\s+(?:the\s+)?(?:curious|little|brave|friendly)?\s*(?:cat|hedgehog|rabbit|fox|mouse|squirrel|bird|butterfly|turtle|deer|owl)/gi,
    );
    let characterName = null;

    if (characterMatches && characterMatches.length > 0) {
      // Extract just the name part
      const match = characterMatches[0].match(/^([A-Z][a-z]+)/);
      characterName = match ? match[1] : null;
    }

    // Fallback: look for any capitalized word that could be a name
    if (!characterName) {
      const nameMatches = fullContext.match(/\b([A-Z][a-z]{3,})\b/g);
      if (nameMatches) {
        // Filter out common words that aren't names
        const excludeWords = [
          'When',
          'This',
          'That',
          'Then',
          'Now',
          'Here',
          'There',
          'What',
          'Where',
          'How',
        ];
        const potentialNames = nameMatches.filter(
          name => !excludeWords.includes(name),
        );
        characterName = potentialNames.length > 0 ? potentialNames[0] : null;
      }
    }

    // Extract animal types including birds like owls
    const animalMatch = fullContext.match(
      /\b(hedgehog|rabbit|fox|cat|mouse|squirrel|bird|butterfly|turtle|deer|owl)\b/i,
    );
    const animalType = animalMatch ? animalMatch[1] : null;

    // Enhanced object extraction for fantasy elements
    const objectMatch = fullContext.match(
      /\b(key|crystal|stone|gem|map|book|compass|bell|star|object|token|tokens)\b/i,
    );
    const keyObject = objectMatch ? objectMatch[1] : null;

    // Extract important locations and concepts
    const locationMatch = fullContext.match(
      /\b(oak tree|tree|emporium|realm|forest|garden|pond)\b/i,
    );
    const keyLocation = locationMatch ? locationMatch[1] : null;

    console.log('🔍 Character extraction:', {
      characterName,
      animalType,
      keyObject,
      keyLocation,
      userInputPreview: userInput.substring(0, 150),
      fullContextLength: fullContext.length,
      characterMatches: characterMatches ? characterMatches.slice(-3) : null,
      foundKeywords: {
        hasDialogue,
        hasAction,
        hasEmotion,
        hasMovement,
        hasDecision,
      },
    });

    // Analyze user's specific contribution for dialogue and actions
    const hasDialogue = /[""]|said|asked|replied|whispered|called|shouted/.test(
      inputLower,
    );
    const hasAction =
      /\b(ran|running|chase|chasing|escape|escaping|dive|diving|jump|jumping|climb|climbing|race|racing|touch|grabbed|ring|ringing)\b/.test(
        inputLower,
      );
    const hasEmotion =
      /\b(heart|racing|scared|afraid|excited|nervous|determined|brave|worried|thoughtful|wondered)\b/.test(
        inputLower,
      );
    const hasMovement =
      /\b(through|into|over|under|past|around|behind|between|toward|floating)\b/.test(
        inputLower,
      );
    const hasDecision =
      /\b(should|decide|choice|together|agree|think|consider)\b/.test(
        inputLower,
      );

    // For complex dialogue and fantasy scenes (like Celeste's prophecy)
    if (hasDialogue && (keyObject || keyLocation)) {
      const dialogueContinuations = {
        'K-2': [
          `${characterName || 'The wise character'} ${
            animalType ? `the ${animalType}` : ''
          } felt excited about the important quest ahead. All the friends were ready to help.`,
          `The magical ${
            keyObject || 'objects'
          } seemed to glow brighter, showing everyone the way to ${
            keyLocation || 'the special place'
          }.`,
          `${
            characterName || 'The character'
          } smiled warmly, knowing that together they could do anything.`,
          `Everyone felt brave and ready for the big adventure that was about to begin.`,
        ],
        '3-5': [
          `${characterName || 'The wise character'} ${
            animalType ? `the ${animalType}` : ''
          } knew that gathering all the ${keyObject || 'magical items'} at ${
            keyLocation || 'the special place'
          } would require courage and teamwork.`,
          `The ancient magic began to stir as ${
            characterName || 'the guide'
          }'s words echoed through the forest, calling all the scattered friends to unite.`,
          `${
            characterName || 'The character'
          } understood that time was running short, but the power of friendship would make their quest possible.`,
          `The ${
            keyObject || 'tokens'
          } seemed to pulse with energy, responding to ${
            characterName || 'the character'
          }'s wise guidance.`,
        ],
        '6-8': [
          `${characterName || 'The ancient guardian'} ${
            animalType ? `the ${animalType}` : ''
          } understood the gravity of the situation - the ${
            keyObject || 'seventh token'
          } was the key to saving those trapped in the ${
            keyLocation || 'shadow realm'
          }.`,
          `Time was their enemy now, with only hours remaining before the ${
            keyLocation || 'portal'
          } would close forever, but ${
            characterName || 'the wise one'
          } had faith in their companions.`,
          `${
            characterName || 'The character'
          }'s ancient knowledge guided them toward the final gathering, where united they would unlock the power needed to complete their mission.`,
          `The magical energy surrounding ${
            keyLocation || 'the old oak tree'
          } began to intensify, responding to ${
            characterName || 'the character'
          }'s call for unity.`,
        ],
        '9-12': [
          `${characterName || 'The oracle'} ${
            animalType ? `the ${animalType}` : ''
          } had seen this moment in countless visions - the convergence of all ${
            keyObject || 'tokens'
          } would either save the trapped souls or doom them forever.`,
          `The weight of ancient prophecy settled upon them as ${
            characterName || 'the seer'
          } spoke of the ${
            keyLocation || 'thirteenth hour'
          }, when dimensional barriers would be at their weakest.`,
          `${
            characterName || 'The character'
          }'s words carried the wisdom of ages, understanding that the rescue of those in the ${
            keyLocation || 'shadow realm'
          } depended on perfect timing and unwavering unity.`,
        ],
      };

      const gradeContinuations =
        dialogueContinuations[gradeLevel] || dialogueContinuations['K-2'];
      return gradeContinuations[
        Math.floor(Math.random() * gradeContinuations.length)
      ];
    }

    // For action scenes
    if (hasAction && hasMovement) {
      const actionContinuations = {
        'K-2': [
          `${
            characterName || 'The character'
          } felt safe and excited about what would happen next. The adventure was getting more fun.`,
          `Something magical started to happen, and ${
            characterName || 'the friend'
          } felt ready for a wonderful surprise.`,
        ],
        '3-5': [
          `${
            characterName || 'The character'
          } realized that their quick thinking had led them exactly where they needed to be for the next part of their journey.`,
          `The ${
            keyObject || 'magical object'
          } seemed to respond to their brave actions, glowing brighter as if approving of their courage.`,
        ],
        '6-8': [
          `${
            characterName || 'The character'
          }'s actions had been more than coincidence—they were part of a larger pattern that was only now becoming clear.`,
          `The energy of the ${
            keyObject || 'artifact'
          } pulsed in harmony with their movements, suggesting a deeper connection than they had realized.`,
        ],
        '9-12': [
          `${
            characterName || 'The character'
          } understood that their actions had triggered something ancient and significant, a chain of events that would reshape their understanding of their own capabilities.`,
        ],
      };

      const gradeContinuations =
        actionContinuations[gradeLevel] || actionContinuations['K-2'];
      return gradeContinuations[
        Math.floor(Math.random() * gradeContinuations.length)
      ];
    }

    // Default continuation if we have character/object info
    if (characterName || keyObject) {
      const defaultContinuations = {
        'K-2': [
          `${
            characterName || 'The friend'
          } felt happy and excited about their adventure together. Something wonderful was about to happen.`,
          `The ${
            keyObject || 'special object'
          } seemed to sparkle with magic, ready to help them on their journey.`,
        ],
        '3-5': [
          `${
            characterName || 'The character'
          } sensed that their adventure was about to take an exciting new turn.`,
          `The ${
            keyObject || 'magical item'
          } pulsed with energy, as if responding to the moment.`,
        ],
        '6-8': [
          `${
            characterName || 'The character'
          } felt the significance of this moment, understanding that everything was about to change.`,
          `The ${
            keyObject || 'artifact'
          } seemed to resonate with deeper meaning than they had first realized.`,
        ],
        '9-12': [
          `${
            characterName || 'The character'
          } recognized that this was a pivotal moment in their journey of self-discovery.`,
        ],
      };

      const gradeContinuations =
        defaultContinuations[gradeLevel] || defaultContinuations['K-2'];
      return gradeContinuations[
        Math.floor(Math.random() * gradeContinuations.length)
      ];
    }

    // No contextual information found
    return null;
  }

  private getRandomEmotion(gradeLevel: GradeLevel): string {
    const emotions = {
      'K-2': [
        'happy',
        'excited',
        'curious',
        'brave',
        'kind',
        'surprised',
        'cheerful',
      ],
      '3-5': [
        'determined',
        'confident',
        'fascinated',
        'thoughtful',
        'hopeful',
        'amazed',
        'inspired',
      ],
      '6-8': [
        'contemplative',
        'resilient',
        'perceptive',
        'introspective',
        'motivated',
        'enlightened',
        'empowered',
      ],
      '9-12': [
        'philosophical',
        'introspective',
        'analytical',
        'reflective',
        'transformative',
        'profound',
        'purposeful',
      ],
    };

    const gradeEmotions = emotions[gradeLevel] || emotions['K-2'];
    return gradeEmotions[Math.floor(Math.random() * gradeEmotions.length)];
  }

  public updateConfig(newConfig: Partial<StoryServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    // Configuration now handled by openaiClient through environment
  }

  public getConfig(): StoryServiceConfig {
    return { ...this.config };
  }

  public isReady(): boolean {
    return openaiClient.isConfigured() || this.config.fallbackEnabled;
  }
}

// Export singleton instance
export const storyGenerationService = new StoryGenerationService();
export default StoryGenerationService;
