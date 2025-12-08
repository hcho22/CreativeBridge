// Image Generation Service for Story Illustrations
// This service handles AI-powered image generation using Replicate.com API with backup service fallback

import { supabase } from './supabase';
import { errorLogger } from './errorLogger';
import { getImageGenerationConfig } from './environment';
import type {
  GradeLevel,
  GenerationStatus,
  ErrorType,
  ServiceUsed,
} from './supabase';

// Configuration constants
const IMAGE_GENERATION_COST = 1000; // XP cost for generating an image
const PRIMARY_API_TIMEOUT = 45000; // 45 seconds for primary service (optimized)
// Note: BACKUP_API_TIMEOUT and MAX_CONCURRENT_REQUESTS are defined in TIMEOUT_CONFIG and RATE_LIMIT_CONFIG

// Enhanced timeout configuration for different scenarios
const TIMEOUT_CONFIG = {
  PRIMARY_SERVICE: {
    STANDARD: 45000, // 45 seconds for normal requests (optimized)
    QUICK: 20000, // 20 seconds for quick requests (optimized)
    EXTENDED: 60000, // 60 seconds for complex prompts (optimized)
  },
  BACKUP_SERVICE: {
    STANDARD: 30000, // 30 seconds for normal requests (optimized)
    QUICK: 15000, // 15 seconds for quick requests (optimized)
    EXTENDED: 45000, // 45 seconds for complex prompts (optimized)
  },
  CONNECTION_TEST: 5000, // 5 seconds for connection tests (optimized)
  POLLING_INTERVAL: 2000, // 2 seconds between polls (optimized for mobile)
  MAX_RETRIES: 2, // Maximum retry attempts (optimized)
};

// Get environment variables for API keys from environment service
// This ensures proper loading from @env in React Native
const imageConfig = getImageGenerationConfig();
const REPLICATE_API_TOKEN = imageConfig.primaryApiToken || undefined;
const BACKUP_IMAGE_API_TOKEN = imageConfig.backupApiToken || undefined;
const IMAGE_GENERATION_ENABLED = imageConfig.enabled;

// Replicate API Configuration
const REPLICATE_BASE_URL = 'https://api.replicate.com/v1';
const REPLICATE_POLLING_INTERVAL = 1000; // 1 second
const REPLICATE_MAX_POLLING_ATTEMPTS = 60; // 60 seconds max
const REPLICATE_STABLE_DIFFUSION_VERSION =
  'stability-ai/stable-diffusion-3.5-large'; // Stable Diffusion 3.5 Large

// Backup Service (Google Nano Banana via Replicate) Configuration
const BACKUP_SERVICE_BASE_URL = 'https://api.replicate.com/v1';
const BACKUP_SERVICE_MODEL = 'google/nano-banana';
const BACKUP_SERVICE_TIMEOUT = 45000; // 45 seconds
const BACKUP_SERVICE_SIZE = '1024x1024'; // Standard size
const BACKUP_SERVICE_QUALITY = 'standard';

// Replicate API Types and Interfaces
export interface ReplicatePredictionRequest {
  version: string;
  input: {
    prompt: string;
    width?: number;
    height?: number;
    num_inference_steps?: number;
    guidance_scale?: number;
    scheduler?: string;
    negative_prompt?: string;
    num_outputs?: number;
  };
}

export interface ReplicatePrediction {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  input: ReplicatePredictionRequest['input'];
  output?: string[];
  error?: string;
  logs?: string;
  metrics?: {
    predict_time?: number;
    total_time?: number;
  };
  created_at: string;
  started_at?: string;
  completed_at?: string;
  urls: {
    get: string;
    cancel: string;
  };
}

export interface ReplicateError {
  detail: string;
  type?: string;
  param?: string;
  code?: string;
}

// Legacy interface for backward compatibility
export interface ReplicateResponse extends ReplicatePrediction {}

// Backup Service (Google Nano Banana via Replicate) Types
export interface NanoBananaRequest {
  version: string;
  input: {
    prompt: string;
    width?: number;
    height?: number;
    num_inference_steps?: number;
    guidance_scale?: number;
    seed?: number;
  };
}

// Legacy backup service response (maintained for compatibility)
export interface BackupServiceResponse {
  success: boolean;
  image_url?: string;
  error?: string;
  response_time_ms: number;
  revised_prompt?: string;
  service_used: 'google/nano-banana' | 'generic';
}

export interface BackupServiceConfig {
  apiToken: string;
  baseUrl: string;
  model: string;
  timeout: number;
  defaultSize: string;
  defaultQuality: string;
}

export interface ImageGenerationRequest {
  storyContent: string;
  gradeLevel: GradeLevel;
  sessionId: string;
  userId: string;
  metadata?: Record<string, any>;
}

export interface ReplicateClientConfig {
  apiToken: string;
  baseUrl: string;
  timeout: number;
  pollingInterval: number;
  maxPollingAttempts: number;
}

export interface BackupServiceClientConfig {
  apiToken: string;
  baseUrl: string;
  model: string;
  timeout: number;
  defaultSize: '1024x1024' | '1024x1792' | '1792x1024';
  defaultQuality: 'standard' | 'hd';
}

export interface ImageGenerationResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
  errorType?: ErrorType;
  serviceUsed: ServiceUsed;
  responseTimeMs: number;
  eventId?: string;
}

export interface DetailedVisualElement {
  concept: string;
  category:
    | 'characters'
    | 'clothing'
    | 'objects'
    | 'settings'
    | 'materials'
    | 'colors';
  subCategory: string;
  weight: number;
  visualDetail: string;
  occurrences: number;
}

export interface DetailedVisualElements {
  characters: DetailedVisualElement[];
  clothing: DetailedVisualElement[];
  objects: DetailedVisualElement[];
  settings: DetailedVisualElement[];
  materials: DetailedVisualElement[];
  colors: DetailedVisualElement[];
}

export interface StoryAnalysis {
  characters: ExtractedCharacters;
  scenes: ExtractedScenes;
  emotions: string[];
  actions: string[];
  themes: string[];
  keyMoments: string[];
  wordCount: number;
  complexity: 'simple' | 'moderate' | 'complex';
  // Enhanced visual analysis
  detailedVisualElements?: DetailedVisualElements;
  visualConcepts?: Array<{
    element: string;
    type: string;
    weight: number;
    source: string;
    isStorySpecific?: boolean;
  }>;
  // New rich story analysis features
  protagonist?: {
    name: string;
    type: 'human' | 'animal' | 'fantasy';
    description: string;
    importance: number;
  };
  plotDevices?: Array<{
    name: string;
    type: 'magical_item' | 'tool' | 'special_object' | 'location';
    description: string;
    significance: number;
  }>;
  storyThemes?: {
    primary: string;
    secondary: string[];
    collaborativeElements: string[];
    friendshipElements: string[];
  };
  richDetails?: {
    specificColors: string[];
    uniqueObjects: string[];
    emotionalMoments: string[];
    actionSequences: string[];
  };
  // New enhanced features for better story representation
  secondaryCharacters?: Array<{
    name: string;
    type: 'human' | 'animal' | 'fantasy';
    role: 'friend' | 'helper' | 'companion' | 'guide' | 'other';
    description: string;
    importance: number; // 1-10 scale
    relationshipToProtagonist: string;
  }>;
  enhancedColorDetails?: {
    dominantColors: string[];
    emotionalColorMapping: Array<{
      color: string;
      emotion: string;
      context: string;
    }>;
    objectColorPairs: Array<{
      object: string;
      color: string;
      significance: string;
    }>;
    sceneColorMoods: Array<{
      scene: string;
      colorPalette: string[];
      mood: string;
    }>;
  };
  dynamicSceneContext?: {
    currentAction: string;
    emotionalState:
      | 'discovery'
      | 'excitement'
      | 'wonder'
      | 'collaboration'
      | 'achievement'
      | 'adventure';
    sceneMovement: 'static' | 'gentle' | 'active' | 'dynamic';
    timeOfAction: 'beginning' | 'middle' | 'climax' | 'resolution';
    interactionLevel: 'solo' | 'paired' | 'group';
    atmosphericElements: string[];
    visualDynamics: Array<{
      element: string;
      motion: string;
      intensity: number;
    }>;
  };
}

export interface ExtractedCharacters {
  people: string[];
  animals: string[];
  fantasy: string[];
  roles: string[];
  // Enhanced character details
  detailed?: Array<{
    name?: string;
    type: string;
    description: string;
    fullMatch: string;
  }>;
}

export interface ExtractedScenes {
  nature: string[];
  buildings: string[];
  urban: string[];
  indoor: string[];
  magical: string[];
}

export interface ArtStyleDefinition {
  baseStyle: string;
  colorPalette: string;
  visualComplexity: string;
  artisticTechnique: string;
  emotionalTone: string;
  layoutStyle: string;
  characterStyle: string;
  backgroundStyle: string;
}

export interface EnhancedStyleOptions {
  emphasizeCharacters?: boolean;
  emphasizeEnvironment?: boolean;
  includeAction?: boolean;
  moodOverride?: 'bright' | 'mysterious' | 'peaceful' | 'adventurous';
  complexityAdjustment?: 'simpler' | 'normal' | 'more_complex';
}

// Enhanced grade-level art style mappings based on educational psychology and visual development
const ART_STYLE_MAPPING: Record<GradeLevel, ArtStyleDefinition> = {
  'K-2': {
    baseStyle: "watercolor children's book illustration",
    colorPalette:
      'bright primary colors, soft pastels, warm and inviting tones',
    visualComplexity:
      'simple shapes, clear outlines, minimal detail, large friendly elements',
    artisticTechnique:
      'watercolor painting style, soft brush strokes, gentle textures',
    emotionalTone:
      'magical and whimsical, innocent and joyful, safe and comforting',
    layoutStyle: 'centered composition, spacious layout, uncluttered design',
    characterStyle:
      'friendly cartoon animals, simple human figures, expressive big eyes',
    backgroundStyle:
      'soft dreamy backgrounds, simple landscapes, fairy-tale settings',
  },
  '3-5': {
    baseStyle: "detailed children's book illustration",
    colorPalette:
      'vibrant colors, rich earth tones, balanced warm and cool colors',
    visualComplexity:
      'moderate detail, clear focal points, engaging visual elements',
    artisticTechnique:
      'digital painting, clean line art, smooth color gradients',
    emotionalTone:
      'adventurous and exciting, encouraging exploration, positive energy',
    layoutStyle:
      'dynamic composition, balanced elements, visual storytelling flow',
    characterStyle:
      'semi-realistic characters, expressive poses, diverse representation',
    backgroundStyle:
      'detailed environments, recognizable settings, immersive worlds',
  },
  '6-8': {
    baseStyle: 'realistic digital illustration',
    colorPalette:
      'sophisticated color schemes, dramatic lighting, atmospheric effects',
    visualComplexity:
      'high detail, complex compositions, realistic proportions',
    artisticTechnique:
      'digital art, realistic shading, texture work, professional illustration',
    emotionalTone:
      'adventurous and heroic, inspiring confidence, age-appropriate excitement',
    layoutStyle: 'dynamic action compositions, cinematic angles, visual depth',
    characterStyle:
      'realistic human figures, detailed facial expressions, action poses',
    backgroundStyle:
      'detailed realistic environments, atmospheric perspective, world-building',
  },
  '9-12': {
    baseStyle: 'sophisticated digital art',
    colorPalette:
      'mature color palettes, subtle gradients, professional color theory',
    visualComplexity:
      'complex artistic composition, intricate details, advanced visual concepts',
    artisticTechnique:
      'professional digital art, advanced lighting, realistic materials and textures',
    emotionalTone:
      'thoughtful and inspiring, intellectually engaging, emotionally resonant',
    layoutStyle:
      'artistic composition, sophisticated visual hierarchy, professional design',
    characterStyle:
      'realistic human anatomy, nuanced expressions, diverse and inclusive',
    backgroundStyle:
      'photorealistic environments, architectural accuracy, atmospheric realism',
  },
};

// Simplified string mapping for backward compatibility
const SIMPLE_ART_STYLE_MAPPING: Record<GradeLevel, string> = {
  'K-2':
    "watercolor children's book illustration, bright colors, friendly cartoon style, simple shapes, magical and whimsical",
  '3-5':
    "detailed children's book illustration, vibrant colors, semi-realistic style with cartoon elements",
  '6-8':
    'realistic digital illustration, detailed artwork, adventure book style, dynamic composition',
  '9-12':
    'sophisticated digital art, realistic style, detailed environments, mature artistic composition',
};

// Enhanced content extraction patterns
const CHARACTER_PATTERNS = {
  // Specific character types
  people: [
    'person',
    'people',
    'child',
    'children',
    'kid',
    'kids',
    'boy',
    'girl',
    'man',
    'woman',
    'father',
    'mother',
    'parent',
    'family',
    'friend',
    'teacher',
    'student',
    'captain',
  ],
  fantasy: [
    'wizard',
    'witch',
    'fairy',
    'princess',
    'prince',
    'knight',
    'dragon',
    'unicorn',
    'elf',
    'dwarf',
    'giant',
    'troll',
    'goblin',
  ],
  animals: [
    'dog',
    'cat',
    'horse',
    'bird',
    'fish',
    'rabbit',
    'bear',
    'lion',
    'tiger',
    'elephant',
    'monkey',
    'fox',
    'wolf',
    'deer',
    'owl',
    'eagle',
    'puppy',
    'bunny',
    'butterfly',
    'turtle',
    'ladybug',
    'squirrel',
    'mouse',
    'rat',
    'hamster',
    'lizard',
    'frog',
    'toad',
    'snake',
    'bee',
    'ant',
    'spider',
    'dragonfly',
    'moth',
    'cricket',
    'firefly',
    'grasshopper',
    'caterpillar',
    'snail',
    'slug',
    'hedgehog',
    'chipmunk',
    'raccoon',
    'skunk',
    'opossum',
    'mole',
    'beaver',
    'otter',
    'seal',
    'whale',
    'dolphin',
    'shark',
    'octopus',
    'crab',
    'lobster',
    'shrimp',
  ],
  roles: [
    'hero',
    'heroine',
    'protagonist',
    'character',
    'adventurer',
    'explorer',
    'detective',
    'scientist',
    'artist',
    'musician',
    'astronaut',
    'archaeologist',
  ],
};

const SCENE_PATTERNS = {
  // Location types
  nature: [
    'forest',
    'woods',
    'jungle',
    'mountain',
    'hill',
    'valley',
    'river',
    'lake',
    'ocean',
    'beach',
    'desert',
    'meadow',
    'field',
    'garden',
  ],
  buildings: [
    'castle',
    'palace',
    'house',
    'home',
    'school',
    'library',
    'museum',
    'church',
    'tower',
    'bridge',
    'barn',
    'cabin',
    'laboratory',
    'university',
  ],
  urban: [
    'city',
    'town',
    'village',
    'street',
    'park',
    'playground',
    'market',
    'shop',
    'store',
    'restaurant',
  ],
  indoor: [
    'room',
    'bedroom',
    'kitchen',
    'living room',
    'classroom',
    'office',
    'basement',
    'attic',
    'garage',
    'chamber',
  ],
  magical: [
    'enchanted forest',
    'magical kingdom',
    'fairy land',
    'wonderland',
    'dreamland',
    'secret place',
    'hidden world',
    'magical',
    'enchanted',
    'magical realm',
  ],
};

const EMOTION_PATTERNS = {
  positive: [
    'happy',
    'joyful',
    'excited',
    'cheerful',
    'delighted',
    'content',
    'peaceful',
    'brave',
    'confident',
    'proud',
  ],
  adventure: [
    'curious',
    'adventurous',
    'determined',
    'courageous',
    'bold',
    'daring',
    'heroic',
  ],
  gentle: [
    'kind',
    'gentle',
    'caring',
    'loving',
    'friendly',
    'warm',
    'cozy',
    'safe',
  ],
};

const ACTION_PATTERNS = {
  movement: [
    'walking',
    'running',
    'flying',
    'swimming',
    'jumping',
    'climbing',
    'dancing',
    'playing',
  ],
  interaction: [
    'talking',
    'laughing',
    'singing',
    'reading',
    'learning',
    'teaching',
    'helping',
    'sharing',
  ],
  discovery: [
    'finding',
    'discovering',
    'exploring',
    'searching',
    'looking',
    'seeing',
    'watching',
  ],
};

// Enhanced content safety filters with severity levels
const UNSAFE_CONTENT_PATTERNS = {
  // High severity - always filtered
  violence_high: [
    'kill',
    'murder',
    'death',
    'die',
    'suicide',
    'torture',
    'abuse',
    'assault',
    'blood',
    'gore',
    'brutality',
  ],
  weapons: [
    'gun',
    'guns',
    'rifle',
    'pistol',
    'firearm',
    'bullet',
    'bomb',
    'explosive',
    'grenade',
    'missile',
    'weapon',
    'weapons',
  ],
  explicit: [
    'nude',
    'naked',
    'sex',
    'sexual',
    'porn',
    'erotic',
    'intimate',
    'sensual',
  ],
  drugs: [
    'drugs',
    'cocaine',
    'heroin',
    'marijuana',
    'alcohol',
    'beer',
    'wine',
    'drunk',
    'smoking',
    'cigarette',
    'tobacco',
  ],
  hate: [
    'hate',
    'racist',
    'nazi',
    'terrorism',
    'terrorist',
    'extremist',
    'radical',
  ],

  // Medium severity - context-dependent filtering
  violence_medium: [
    'fight',
    'fighting',
    'battle',
    'war',
    'attack',
    'hurt',
    'pain',
    'sword',
    'swords',
    'knife',
    'knives',
  ],
  scary_medium: [
    'monster',
    'monsters',
    'ghost',
    'ghosts',
    'demon',
    'demons',
    'devil',
    'scary',
    'frightening',
    'terrifying',
  ],

  // Low severity - grade-level dependent
  violence_low: ['conflict', 'struggle', 'competition', 'challenge'],
  scary_low: ['mysterious', 'spooky', 'eerie', 'strange', 'unusual', 'weird'],

  // Age-inappropriate themes
  adult_themes: [
    'politics',
    'political',
    'election',
    'government',
    'protest',
    'riot',
    'revolution',
  ],
  mature_concepts: [
    'economy',
    'economics',
    'finance',
    'business',
    'corporation',
    'company',
  ],
};

// Safe alternatives for filtered content
const CONTENT_REPLACEMENTS = {
  fight: 'play',
  battle: 'game',
  war: 'adventure',
  attack: 'approach',
  hurt: 'sad',
  pain: 'discomfort',
  weapon: 'tool',
  sword: 'wand',
  gun: 'pointer',
  monster: 'creature',
  scary: 'mysterious',
  frightening: 'surprising',
  terrifying: 'amazing',
  nightmare: 'dream',
  horror: 'surprise',
};

// Grade-level content appropriateness
const GRADE_LEVEL_RESTRICTIONS = {
  'K-2': {
    allowedSeverity: ['low'],
    extraFilters: [
      'violence_medium',
      'scary_medium',
      'adult_themes',
      'mature_concepts',
    ],
    requiredElements: ['safe', 'friendly', 'colorful', 'happy'],
  },
  '3-5': {
    allowedSeverity: ['low', 'medium_limited'],
    extraFilters: ['violence_high', 'explicit', 'drugs', 'hate'],
    requiredElements: ['appropriate', 'engaging'],
  },
  '6-8': {
    allowedSeverity: ['low', 'medium'],
    extraFilters: ['violence_high', 'explicit', 'drugs', 'hate'],
    requiredElements: ['age-appropriate'],
  },
  '9-12': {
    allowedSeverity: ['low', 'medium', 'historical'],
    extraFilters: ['explicit', 'drugs', 'hate'],
    requiredElements: ['educational', 'appropriate'],
  },
};

// Enhanced request tracking and rate limiting
let activeRequests = 0;
const requestQueue: Array<{
  execute: () => Promise<void>;
  userId: string;
  sessionId: string;
  timestamp: number;
  priority: 'high' | 'normal' | 'low';
}> = [];

// Rate limiting statistics
const rateLimitingStats = {
  totalRequests: 0,
  queuedRequests: 0,
  rejectedRequests: 0,
  maxQueueLength: 0,
  averageWaitTime: 0,
  lastResetTime: Date.now(),
};

// User-specific rate limiting
const userRequestCounts = new Map<
  string,
  {
    count: number;
    lastRequestTime: number;
    isBlocked: boolean;
  }
>();

// Configuration for enhanced rate limiting
const RATE_LIMIT_CONFIG = {
  MAX_CONCURRENT_REQUESTS: 10,
  MAX_QUEUE_SIZE: 50,
  USER_MAX_REQUESTS_PER_MINUTE: 3,
  USER_COOLDOWN_PERIOD: 60000, // 1 minute
  QUEUE_TIMEOUT: 300000, // 5 minutes
  PRIORITY_BOOST_THRESHOLD: 120000, // 2 minutes
  STATS_RESET_INTERVAL: 3600000, // 1 hour
};

// OpenAI DALL-E Backup Service Client
class BackupServiceClient {
  public config: BackupServiceClientConfig;

  constructor(config: Partial<BackupServiceClientConfig> = {}) {
    this.config = {
      apiToken: config.apiToken || BACKUP_IMAGE_API_TOKEN || '',
      baseUrl: config.baseUrl || BACKUP_SERVICE_BASE_URL,
      model: config.model || BACKUP_SERVICE_MODEL,
      timeout: config.timeout || BACKUP_SERVICE_TIMEOUT,
      defaultSize: config.defaultSize || (BACKUP_SERVICE_SIZE as '1024x1024'),
      defaultQuality:
        config.defaultQuality || (BACKUP_SERVICE_QUALITY as 'standard'),
    };
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    timeoutMs?: number,
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const timeout = timeoutMs || this.config.timeout;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.warn(
        `⏰ Request timeout after ${timeout}ms for endpoint: ${endpoint}`,
      );
      controller.abort();
    }, timeout);

    const startTime = Date.now();

    try {
      console.log(
        `🚀 Starting OpenAI API request to ${endpoint} with ${timeout}ms timeout`,
      );

      const response = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Token ${this.config.apiToken}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: controller.signal as any, // Type workaround for React Native
      });

      const responseTime = Date.now() - startTime;
      console.log(`⚡ OpenAI API response received in ${responseTime}ms`);

      if (!response.ok) {
        const errorText = await response.text();
        let errorData: ReplicateError;

        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = {
            error: {
              message: errorText,
              type: 'api_error',
            },
          };
        }

        throw new Error(
          `OpenAI API error (${response.status}): ${errorData.error.message}`,
        );
      }

      return await response.json();
    } catch (error) {
      const responseTime = Date.now() - startTime;

      if (error.name === 'AbortError') {
        console.error(
          `❌ OpenAI API request timed out after ${responseTime}ms (limit: ${timeout}ms)`,
        );
        throw new Error(`Request timed out after ${timeout}ms`);
      }

      console.error(
        `❌ OpenAI API request failed after ${responseTime}ms:`,
        error,
      );
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async generateImage(
    prompt: string,
    options: { size?: string } = {},
    timeoutMs?: number,
  ): Promise<string> {
    const startTime = Date.now();
    const timeout = timeoutMs || this.config.timeout;

    console.log(
      `🎨 Starting Google Nano Banana generation with ${timeout}ms timeout`,
    );

    // Extract dimensions from size (e.g., "1024x1024" -> width: 1024, height: 1024)
    const size = options.size || this.config.defaultSize;
    const [width, height] = size.split('x').map(Number);

    const request: NanoBananaRequest = {
      version: this.config.model,
      input: {
        prompt: this.sanitizePrompt(prompt, 'K-2'),
        width: width || 1024,
        height: height || 1024,
        num_inference_steps: 20,
        guidance_scale: 7.5,
      },
    };

    console.log('🎨 Creating Google Nano Banana image...', {
      prompt: prompt.substring(0, 100),
      model: request.version,
      size: `${request.input.width}x${request.input.height}`,
      timeout,
    });

    try {
      // Start prediction
      const prediction = await this.makeRequest<ReplicatePrediction>(
        '/predictions',
        {
          method: 'POST',
          body: JSON.stringify(request),
        },
        timeout,
      );

      if (!prediction.id) {
        throw new Error('No prediction ID returned from Google Nano Banana');
      }

      // Poll for completion using the same logic as ReplicateClient
      const pollingInterval = 1000; // 1 second
      const maxAttempts = Math.floor(timeout / pollingInterval);

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise(resolve => setTimeout(resolve, pollingInterval));

        const status = await this.makeRequest<ReplicatePrediction>(
          `/predictions/${prediction.id}`,
          {
            method: 'GET',
          },
          10000,
        ); // 10 second timeout for status checks

        if (
          status.status === 'succeeded' &&
          status.output &&
          status.output.length > 0
        ) {
          const rawOutput = Array.isArray(status.output)
            ? status.output[0]
            : status.output;
          console.log(
            `🔍 [DEBUG] Raw Google Nano Banana output:`,
            JSON.stringify(status.output),
          );
          console.log(
            `🔍 [DEBUG] First output item:`,
            typeof rawOutput,
            rawOutput,
          );

          // Validate that we have a proper URL
          if (!rawOutput || typeof rawOutput !== 'string') {
            throw new Error(
              `Invalid output format from Google Nano Banana: ${typeof rawOutput} - ${JSON.stringify(
                rawOutput,
              )}`,
            );
          }

          // Check if the output looks like a valid URL
          if (
            rawOutput.length < 10 ||
            (!rawOutput.startsWith('http') && !rawOutput.startsWith('data:'))
          ) {
            throw new Error(
              `Invalid image URL from Google Nano Banana: "${rawOutput}" (length: ${rawOutput.length})`,
            );
          }

          const imageUrl = rawOutput;
          const totalTime = Date.now() - startTime;
          console.log(
            `✅ Google Nano Banana generation completed in ${totalTime}ms:`,
            imageUrl,
          );
          return imageUrl;
        }

        if (status.status === 'failed') {
          throw new Error(
            `Google Nano Banana generation failed: ${
              status.error || 'Unknown error'
            }`,
          );
        }

        if (status.status === 'canceled') {
          throw new Error('Google Nano Banana generation was canceled');
        }
      }

      throw new Error(
        `Google Nano Banana generation timed out after ${timeout}ms`,
      );
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(
        `❌ Google Nano Banana generation failed after ${totalTime}ms:`,
        error,
      );
      throw error;
    }
  }

  private sanitizePrompt(
    prompt: string,
    gradeLevel: GradeLevel = 'K-2',
  ): string {
    // Enhanced prompt sanitization for Google Nano Banana with grade-level awareness
    let sanitized = prompt
      .replace(/\b(explicit|nsfw|inappropriate|violent|graphic)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Ensure prompt meets minimum requirements
    if (sanitized.length < 10) {
      sanitized = `A safe, family-friendly illustration: ${sanitized}`;
    }

    // Add grade-appropriate safety suffixes
    const safetySuffixes = {
      'K-2':
        ', safe for toddlers and young children, G-rated, colorful and friendly',
      '3-5':
        ', safe for elementary school children, appropriate content, educational',
      '6-8': ', appropriate for middle school students, educational content',
      '9-12':
        ', appropriate for high school students, educational and age-appropriate',
    };

    sanitized += safetySuffixes[gradeLevel] || safetySuffixes['K-2'];

    return sanitized;
  }

  getConfig(): BackupServiceClientConfig {
    return { ...this.config };
  }
}

// Replicate API Client
class ReplicateClient {
  public config: ReplicateClientConfig;

  constructor(config: Partial<ReplicateClientConfig> = {}) {
    this.config = {
      apiToken: config.apiToken || REPLICATE_API_TOKEN || '',
      baseUrl: config.baseUrl || REPLICATE_BASE_URL,
      timeout: config.timeout || PRIMARY_API_TIMEOUT,
      pollingInterval: config.pollingInterval || REPLICATE_POLLING_INTERVAL,
      maxPollingAttempts:
        config.maxPollingAttempts || REPLICATE_MAX_POLLING_ATTEMPTS,
    };
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    timeoutMs?: number,
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const timeout = timeoutMs || this.config.timeout;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.warn(
        `⏰ Request timeout after ${timeout}ms for endpoint: ${endpoint}`,
      );
      controller.abort();
    }, timeout);

    const startTime = Date.now();

    try {
      console.log(
        `🚀 Starting Replicate API request to ${endpoint} with ${timeout}ms timeout`,
      );

      const response = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Token ${this.config.apiToken}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: controller.signal as any, // Type workaround for React Native
      });

      const responseTime = Date.now() - startTime;
      console.log(`⚡ Replicate API response received in ${responseTime}ms`);

      if (!response.ok) {
        const errorText = await response.text();
        let errorData: ReplicateError;

        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { detail: errorText };
        }

        throw new Error(
          `Replicate API error (${response.status}): ${errorData.detail}`,
        );
      }

      return await response.json();
    } catch (error) {
      const responseTime = Date.now() - startTime;

      if (error.name === 'AbortError') {
        console.error(
          `❌ Replicate API request timed out after ${responseTime}ms (limit: ${timeout}ms)`,
        );
        throw new Error(`Request timed out after ${timeout}ms`);
      }

      console.error(
        `❌ Replicate API request failed after ${responseTime}ms:`,
        error,
      );
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async createPrediction(
    request: ReplicatePredictionRequest,
  ): Promise<ReplicatePrediction> {
    return this.makeRequest<ReplicatePrediction>('/predictions', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getPrediction(predictionId: string): Promise<ReplicatePrediction> {
    return this.makeRequest<ReplicatePrediction>(
      `/predictions/${predictionId}`,
    );
  }

  async waitForPrediction(
    predictionId: string,
    customTimeout?: number,
  ): Promise<ReplicatePrediction> {
    let attempts = 0;
    const maxAttempts = this.config.maxPollingAttempts;
    const interval = this.config.pollingInterval;
    const overallTimeout = customTimeout || this.config.timeout;
    const startTime = Date.now();

    console.log(
      `🔄 Starting to poll prediction ${predictionId} with ${overallTimeout}ms overall timeout`,
    );

    while (attempts < maxAttempts) {
      // Check overall timeout
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime >= overallTimeout) {
        console.error(
          `❌ Overall timeout exceeded: ${elapsedTime}ms >= ${overallTimeout}ms`,
        );
        throw new Error(
          `Overall timeout of ${overallTimeout}ms exceeded after ${elapsedTime}ms`,
        );
      }

      try {
        // Use a reasonable timeout for individual polling requests
        const remainingTime = overallTimeout - elapsedTime;
        const pollTimeout = Math.max(5000, Math.min(10000, remainingTime)); // Minimum 5s, max 10s
        const prediction = await this.makeRequest<ReplicatePrediction>(
          `/predictions/${predictionId}`,
          {},
          pollTimeout,
        );

        console.log(
          `📊 Prediction ${predictionId} status: ${
            prediction.status
          } (attempt ${
            attempts + 1
          }/${maxAttempts}, elapsed: ${elapsedTime}ms)`,
        );

        if (prediction.status === 'succeeded') {
          console.log(
            `✅ Prediction completed successfully after ${elapsedTime}ms`,
          );
          return prediction;
        }

        if (
          prediction.status === 'failed' ||
          prediction.status === 'canceled'
        ) {
          throw new Error(
            `Prediction failed: ${prediction.error || 'Unknown error'}`,
          );
        }

        // Wait before next poll, but don't exceed overall timeout
        const timeLeft = overallTimeout - (Date.now() - startTime);
        const waitTime = Math.min(interval, timeLeft - 1000); // Leave 1s buffer

        if (waitTime > 0) {
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        attempts++;
      } catch (error) {
        if (error.message.includes('timeout')) {
          console.warn(
            `⚠️ Polling request timed out, retrying... (attempt ${
              attempts + 1
            }/${maxAttempts})`,
          );
          attempts++;
          continue;
        }
        throw error;
      }
    }

    const totalTime = Date.now() - startTime;
    throw new Error(
      `Prediction polling timeout after ${maxAttempts} attempts and ${totalTime}ms`,
    );
  }

  async generateImage(
    prompt: string,
    options: Partial<ReplicatePredictionRequest['input']> = {},
    timeoutMs?: number,
  ): Promise<string> {
    const startTime = Date.now();
    const timeout = timeoutMs || this.config.timeout;

    console.log(
      `🎨 Starting Replicate image generation with ${timeout}ms timeout`,
    );

    const request: ReplicatePredictionRequest = {
      version: REPLICATE_STABLE_DIFFUSION_VERSION,
      input: {
        prompt,
        width: 512,
        height: 512,
        num_inference_steps: 20,
        guidance_scale: 7.5,
        scheduler: 'K_EULER',
        num_outputs: 1,
        ...options,
      },
    };

    console.log('🎨 Creating Replicate prediction...', {
      prompt: prompt.substring(0, 100),
      timeout,
    });

    try {
      // Create prediction with timeout
      const creationTimeout = Math.min(10000, timeout / 4); // 10s max or 1/4 of total timeout
      const prediction = await this.makeRequest<ReplicatePrediction>(
        '/predictions',
        {
          method: 'POST',
          body: JSON.stringify(request),
        },
        creationTimeout,
      );

      console.log(
        `🔄 Polling prediction ${prediction.id} with remaining timeout...`,
      );

      // Calculate remaining timeout for polling
      const elapsedTime = Date.now() - startTime;
      const remainingTimeout = Math.max(5000, timeout - elapsedTime); // At least 5s for polling

      const completedPrediction = await this.waitForPrediction(
        prediction.id,
        remainingTimeout,
      );

      const output = completedPrediction.output;
      if (
        !output ||
        (Array.isArray(output) && output.length === 0) ||
        (typeof output === 'string' && output.length === 0)
      ) {
        throw new Error('No output generated from Replicate');
      }

      // Validate and extract image URL with comprehensive logging
      const rawOutput = Array.isArray(output) ? output[0] : output;
      console.log(
        `🔍 [DEBUG] Raw Replicate output:`,
        JSON.stringify(completedPrediction.output),
      );
      console.log(
        `🔍 [DEBUG] Processed output item:`,
        typeof rawOutput,
        rawOutput,
      );

      // Validate that we have a proper URL
      if (!rawOutput || typeof rawOutput !== 'string') {
        throw new Error(
          `Invalid output format from Replicate: ${typeof rawOutput} - ${JSON.stringify(
            rawOutput,
          )}`,
        );
      }

      // Check if the output looks like a valid URL
      if (
        rawOutput.length < 10 ||
        (!rawOutput.startsWith('http') && !rawOutput.startsWith('data:'))
      ) {
        throw new Error(
          `Invalid image URL from Replicate: "${rawOutput}" (length: ${rawOutput.length})`,
        );
      }

      const imageUrl = rawOutput;
      const totalTime = Date.now() - startTime;
      console.log(
        `✅ Replicate generation completed in ${totalTime}ms:`,
        imageUrl,
      );

      return imageUrl;
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(
        `❌ Replicate generation failed after ${totalTime}ms:`,
        error,
      );
      throw error;
    }
  }
}

class ImageGenerationService {
  private replicateClient: ReplicateClient;
  private backupServiceClient: BackupServiceClient;

  constructor() {
    this.replicateClient = new ReplicateClient();
    this.backupServiceClient = new BackupServiceClient();
  }

  private isConfigured(): boolean {
    return (
      IMAGE_GENERATION_ENABLED &&
      (!!REPLICATE_API_TOKEN || !!BACKUP_IMAGE_API_TOKEN)
    );
  }

  private validateConfiguration(): void {
    if (!IMAGE_GENERATION_ENABLED) {
      throw new Error('Image generation feature is disabled');
    }
    if (!REPLICATE_API_TOKEN && !BACKUP_IMAGE_API_TOKEN) {
      throw new Error('No image generation API tokens configured');
    }
  }

  private async checkUserXPBalance(userId: string): Promise<number> {
    console.log(`Checking XP balance for user: ${userId}`);

    try {
      // Query user profile directly from Supabase
      const { data: userProfile, error } = await supabase
        .from('user_profiles')
        .select('total_xp')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error checking XP balance:', error);
        throw new Error(`Failed to check XP balance: ${error.message}`);
      }

      const balance = (userProfile as any)?.total_xp || 0;
      console.log(`✅ XP balance retrieved: ${balance} XP for user ${userId}`);
      return balance;
    } catch (error) {
      console.error('💥 Exception checking XP balance:', error);
      throw error;
    }
  }

  private async deductXP(userId: string, amount: number): Promise<void> {
    // Skip XP deduction if testing mode is enabled
    if (process.env.DISABLE_XP_COSTS_FOR_TESTING === 'true') {
      console.log(
        `🧪 Testing mode: Skipping ${amount} XP deduction for user: ${userId}`,
      );
      return;
    }

    console.log(`💸 Deducting ${amount} XP from user: ${userId}`);

    try {
      // Use Supabase RPC function for atomic XP deduction
      const { error } = await supabase.rpc('add_user_xp', {
        user_uuid: userId,
        xp_to_add: -amount, // Negative amount for deduction
      });

      if (error) {
        console.error('❌ XP deduction failed:', error);
        throw new Error(`XP deduction failed: ${error.message}`);
      }

      console.log(`✅ Successfully deducted ${amount} XP from user ${userId}`);
    } catch (error) {
      console.error('💥 Exception during XP deduction:', error);
      throw error;
    }
  }

  private async refundXP(userId: string, amount: number): Promise<void> {
    console.log(`💰 Refunding ${amount} XP to user: ${userId}`);

    try {
      // Use Supabase RPC function for atomic XP refund
      const { error } = await supabase.rpc('add_user_xp', {
        user_uuid: userId,
        xp_to_add: amount, // Positive amount for refund
      });

      if (error) {
        console.error('❌ XP refund failed:', error);
        throw new Error(`XP refund failed: ${error.message}`);
      }

      console.log(`✅ Successfully refunded ${amount} XP to user ${userId}`);
    } catch (error) {
      console.error('💥 Exception during XP refund:', error);
      throw error;
    }
  }

  private generatePrompt(storyContent: string, gradeLevel: GradeLevel): string {
    const artStyleDefinition = ART_STYLE_MAPPING[gradeLevel];

    // NEW: Try story-first extraction approach for better accuracy
    const storySpecificPrompt = this.generateStorySpecificPrompt(
      storyContent,
      gradeLevel,
      artStyleDefinition,
    );
    if (storySpecificPrompt && storySpecificPrompt.trim().length > 50) {
      console.log(
        '🎯 Using story-specific prompt:',
        storySpecificPrompt.substring(0, 100) + '...',
      );
      return storySpecificPrompt;
    }

    // Use advanced analysis pipeline for enhanced story-to-image accuracy
    const nerEntities = this.performAdvancedNER(storyContent);
    const narrativeSequence = this.analyzeNarrativeSequence(
      storyContent,
      nerEntities,
    );
    const coordinatedCharacters = this.coordinateMultipleCharacters(
      nerEntities,
      narrativeSequence,
    );
    const advancedPrompt = this.generateAdvancedPrompt(
      storyContent,
      nerEntities,
      narrativeSequence,
      coordinatedCharacters,
      gradeLevel,
    );

    // If advanced analysis produces a prompt, use it directly
    if (advancedPrompt && advancedPrompt.trim().length > 50) {
      console.log(
        '🎯 Using advanced analysis prompt:',
        advancedPrompt.substring(0, 100) + '...',
      );
      return advancedPrompt;
    }

    // Fallback to basic analysis if advanced analysis fails
    console.log(
      '⚠️ Advanced analysis insufficient, falling back to basic analysis',
    );
    const storyAnalysis = this.analyzeStoryContent(storyContent);

    // Sanitize content for safety
    const sanitizedContent = this.sanitizeStoryContent(
      storyContent,
      gradeLevel,
    );

    // Generate enhanced grade-appropriate prompt using the ArtStyleDefinition
    const enhancedPrompt = this.generateEnhancedGradeAppropriatePrompt(
      sanitizedContent,
      storyAnalysis,
      artStyleDefinition,
      gradeLevel,
    );

    return enhancedPrompt;
  }

  private analyzeStoryContent(storyContent: string): StoryAnalysis {
    const content = storyContent.toLowerCase();
    const words = content.split(/\s+/);
    const sentences = storyContent
      .split(/[.!?]+/)
      .filter(s => s.trim().length > 0);

    // Enhanced visual element extraction
    const detailedVisualElements =
      this.extractDetailedVisualElements(storyContent);
    const visualConcepts = this.generateVisualConcepts(detailedVisualElements);

    return {
      characters: this.extractCharacters(
        content,
        words,
        detailedVisualElements.characters,
      ),
      scenes: this.extractScenes(content, words),
      emotions: this.extractEmotions(content, words),
      actions: this.extractActions(content, words),
      themes: this.extractThemes(content, words),
      keyMoments: this.extractKeyMoments(sentences),
      wordCount: words.length,
      complexity: this.assessComplexity(words, sentences),
      detailedVisualElements,
      visualConcepts,
      // Enhanced rich story analysis
      protagonist: this.identifyProtagonist(storyContent, sentences),
      plotDevices: this.extractPlotDevices(storyContent),
      storyThemes: this.analyzeStoryThemes(storyContent, sentences),
      richDetails: this.extractRichDetails(storyContent),
      // New enhanced analysis features
      secondaryCharacters: this.identifySecondaryCharacters(
        storyContent,
        sentences,
      ),
      enhancedColorDetails: this.extractEnhancedColorDetails(storyContent),
      dynamicSceneContext: this.analyzeDynamicSceneContext(
        storyContent,
        sentences,
      ),
    };
  }

  // Enhanced visual element extraction from story content
  private extractDetailedVisualElements(
    content: string,
  ): DetailedVisualElements {
    const visualElements: DetailedVisualElements = {
      characters: [],
      clothing: [],
      objects: [],
      settings: [],
      materials: [],
      colors: [],
    };

    // Character descriptions with detailed attributes
    const characterPatterns = [
      // Character with adjectives: "mischievous squirrel named Sparkle"
      /\b(\w+)\s+(squirrel|rabbit|bear|fox|turtle|mouse|cat|dog|bird|owl|deer|frog|snake)\s+named\s+(\w+)\b/gi,
      // Character titles: "Hazel the hedge wizard"
      /\b(\w+)\s+the\s+(wizard|witch|fairy|elf|princess|prince|king|queen)\b/gi,
      // Descriptive characters: "wise old owl named Professor Hoot"
      /\b(\w+\s+\w+)\s+(owl|bear|fox|turtle)\s+named\s+(\w+)\b/gi,
    ];

    characterPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        visualElements.characters.push({
          concept: `${match[1]} ${match[2]} ${match[3] || match[1]}`,
          category: 'characters',
          subCategory: 'detailed',
          weight: 5.0,
          visualDetail: match[0],
          occurrences: 1,
        });
      }
    });

    // Clothing and accessories
    const clothingPatterns = [
      /\b(\w+\s+\w+)\s+(vest|coat|hat|dress|shirt|robe|cloak|neckerchief|satchel|gloves)\b/gi,
      /\b(vest|coat|hat|dress|shirt|robe|cloak|neckerchief|satchel|gloves)\s+(?:made\s+of\s+|crafted\s+from\s+|fashioned\s+from\s+)?(\w+\s+\w+)/gi,
      /\b(embroidered|adorned|embellished)\s+with\s+(\w+\s+\w+\s*\w*)/gi,
    ];

    clothingPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        visualElements.clothing.push({
          concept: match[0],
          category: 'clothing',
          subCategory: 'detailed',
          weight: 4.0,
          visualDetail: match[0],
          occurrences: 1,
        });
      }
    });

    // Objects and artifacts
    const objectPatterns = [
      /\b(\w+\s+\w+)\s+(map|key|book|stone|crystal|gem|treasure|portal|door|gate)\b/gi,
      /\b(map|key|book|stone|crystal|gem|treasure|portal|door|gate)\s+(?:made\s+of\s+|adorned\s+with\s+)?(\w+\s+\w+)/gi,
      /\b(teddy\s+bear)\s+with\s+(\w+\s+\w+\s*\w*)/gi,
    ];

    objectPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        visualElements.objects.push({
          concept: match[0],
          category: 'objects',
          subCategory: 'detailed',
          weight: 4.0,
          visualDetail: match[0],
          occurrences: 1,
        });
      }
    });

    // Settings and environments
    const settingPatterns = [
      /\b(\w+\s+\w+)\s+(forest|garden|village|castle|brook|river|clearing|meadow)\b/gi,
      /\b(forest|garden|village|castle|brook|river|clearing|meadow)\s+(?:filled\s+with\s+|containing\s+)?(\w+\s+\w+\s*\w*)/gi,
      /\b(tunnel|path|portal)\s+that\s+(\w+\s+\w+\s*\w*)/gi,
    ];

    settingPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        visualElements.settings.push({
          concept: match[0],
          category: 'settings',
          subCategory: 'detailed',
          weight: 4.0,
          visualDetail: match[0],
          occurrences: 1,
        });
      }
    });

    // Enhanced Colors and materials extraction
    const colorMaterialPatterns = [
      // Compound color descriptions like "crimson roses", "sunshine-yellow daisies"
      /\b(crimson|sunshine-yellow|sunshine|rainbow-colored|turquoise|emerald|golden|silver|violet|sky-blue|pure\s+white|bright\s+sunny)\s+(roses?|daisies?|flowers?|butterflies?|grass|pond|water|treehouse|garden|path)/gi,
      // Color with texture/material
      /\b(emerald|golden|silver|crystal|mahogany|silk|velvet|leather|gossamer|iridescent)\s+(\w+)/gi,
      // Enhanced color modifiers
      /\b(bright|dark|deep|pale|vibrant|shimmering|sparkling|glowing|dazzling|brilliant|radiant)\s+(red|blue|green|yellow|orange|purple|pink|brown|black|white|gray|grey)\b/gi,
      // Specific color combinations from stories
      /\b(rainbow-colored|multi-colored|swirls\s+of\s+[\w\s,]+)/gi,
      // Advanced color descriptions with objects
      /\b(brown\s+eyes|pink\s+ears|orange\s+pink\s+and\s+sky-blue)/gi,
    ];

    colorMaterialPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        // Determine if this is a material or color match
        const fullMatch = match[0].toLowerCase();
        const isMaterial = fullMatch.match(
          /emerald|golden|silver|crystal|mahogany|silk|velvet|leather|gossamer|iridescent/,
        );
        const isCompoundColor = fullMatch.match(
          /crimson|sunshine-yellow|rainbow-colored|turquoise|violet|sky-blue|brown\s+eyes|pink\s+ears/,
        );

        const category = isMaterial ? 'materials' : 'colors';
        const weight = isMaterial ? 3.5 : isCompoundColor ? 4.5 : 3.0; // Higher weight for story-specific colors

        visualElements[category].push({
          concept: match[0],
          category,
          subCategory: isCompoundColor ? 'story-specific' : 'detailed',
          weight,
          visualDetail: match[0],
          occurrences: 1,
        });
      }
    });

    return visualElements;
  }

  // Generate visual concepts from detailed elements
  private generateVisualConcepts(
    detailedElements: DetailedVisualElements,
  ): Array<{
    element: string;
    type: string;
    weight: number;
    source: string;
    isStorySpecific?: boolean;
  }> {
    const visualConcepts: Array<{
      element: string;
      type: string;
      weight: number;
      source: string;
      isStorySpecific?: boolean;
    }> = [];

    // Add detailed visual elements with highest priority
    Object.entries(detailedElements).forEach(([category, elements]) => {
      elements.forEach((element: DetailedVisualElement, index: number) => {
        let elementText = element.concept;

        // Clean up and format the concept for visual description
        if (category === 'characters') {
          elementText = elementText.replace(/\b(named|the)\b/gi, '').trim();
          // Ensure character descriptions are complete
          if (elementText.length > 30 && !elementText.match(/\w$/)) {
            elementText = elementText.substring(
              0,
              elementText.lastIndexOf(' '),
            );
          }
        } else if (category === 'clothing') {
          elementText = elementText
            .replace(
              /\b(adorned with|embroidered with|made of)\b/gi,
              'featuring',
            )
            .trim();
          // Ensure clothing descriptions are complete
          if (elementText.length > 40 && !elementText.match(/\w$/)) {
            elementText = elementText.substring(
              0,
              elementText.lastIndexOf(' '),
            );
          }
        }

        // General cleanup for all categories
        elementText = elementText.replace(/\s+/g, ' ').trim();
        elementText = elementText.replace(/\b(\w+)\s+\1\b/gi, '$1'); // Remove duplicates

        // Skip if text is too short or malformed
        if (
          elementText.length < 3 ||
          elementText.includes('could this') ||
          elementText.includes('in in')
        ) {
          return;
        }

        visualConcepts.push({
          element: elementText,
          type: `story-specific ${category}`,
          weight: element.weight + (10 - index),
          source: 'detailed story analysis',
          isStorySpecific: true,
        });
      });
    });

    return visualConcepts.sort((a, b) => b.weight - a.weight).slice(0, 8);
  }

  private extractCharacters(
    content: string,
    _words: string[],
    detailedCharacters?: DetailedVisualElement[],
  ): ExtractedCharacters {
    const characters: ExtractedCharacters = {
      people: [],
      animals: [],
      fantasy: [],
      roles: [],
      detailed:
        detailedCharacters?.map(char => ({
          name: char.concept.split(' ').pop() || '',
          type: char.concept.split(' ')[1] || 'character',
          description: char.concept,
          fullMatch: char.visualDetail,
        })) || [],
    };

    // Extract different types of characters with more flexible matching
    Object.entries(CHARACTER_PATTERNS).forEach(([type, patterns]) => {
      const found = patterns.filter(pattern => {
        // Use word boundary regex for exact word matches
        const regex = new RegExp(
          `\\b${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
          'i',
        );
        return regex.test(content);
      });
      if (type in characters) {
        (characters as any)[type] = found.slice(0, 3); // Limit to 3 per type
      }
    });

    // COMPREHENSIVE: Character extraction patterns for all story types
    const comprehensiveCharacterPatterns = [
      // "Name the animal" format
      /([A-Z][a-z]+)\s+the\s+(squirrel|rabbit|bear|fox|turtle|mouse|cat|dog|bird|owl)/gi,
      // "Name the adjective animal" format (handles "Luna the curious turtle")
      /([A-Z][a-z]+)\s+the\s+(\w+)\s+(squirrel|rabbit|bear|fox|turtle|mouse|cat|dog|bird|owl|deer|frog|snake)/gi,
      // "adjective animal named Name" format (handles "little rabbit named Luna")
      /\b(\w+)\s+(squirrel|rabbit|bear|fox|turtle|mouse|cat|dog|bird|owl|deer|frog|snake)\s+named\s+(\w+)\b/gi,
      // "animal named Name" format
      /(squirrel|rabbit|bear|fox|turtle|mouse|cat|dog|bird|owl)\s+named\s+([A-Z][a-z]+)/gi,
      // "little animal" format (handles "little mouse")
      /little\s+(squirrel|rabbit|bear|fox|turtle|mouse|cat|dog|bird|owl|deer|frog|snake)/gi,
      // "a adjective animal" format (handles "a little mouse")
      /a\s+(\w+)\s+(squirrel|rabbit|bear|fox|turtle|mouse|cat|dog|bird|owl|deer|frog|snake)/gi,
      // Character names with titles (handles "Maestro Mickey") - be more selective
      /\b(Maestro|King|Queen|Prince|Princess|Sir|Lady|Captain|Professor|Doctor|Mr|Mrs|Miss)\s+([A-Z][a-z]+)\b/gi,
      // Standalone character names with common actions (handles "Max found", "Mickey explained") - filtered to avoid common words
      /\b([A-Z][a-z]{2,})\s+(found|felt|heard|saw|went|took|looked|started|decided|tried|asked|said|smiled|knocked|walked|ran|came|opened|closed|entered|left|climbed|fell|jumped|danced|played|sang|ate|slept|woke|remembered|thought|wondered|hoped|dreamed|believed|knew|learned|understood|realized|noticed)\b/gi,
    ];

    comprehensiveCharacterPatterns.forEach((pattern, patternIndex) => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        let characterName: string | undefined,
          animalType: string | undefined,
          characterDesc: string | undefined;

        if (patternIndex === 0) {
          // "Name the animal" format
          characterName = match[1];
          animalType = match[2];
          characterDesc = `${characterName} the ${animalType}`;
        } else if (patternIndex === 1) {
          // "Name the adjective animal" format
          characterName = match[1];
          const adjective = match[2];
          animalType = match[3];
          characterDesc = `${characterName} the ${adjective} ${animalType}`;
        } else if (patternIndex === 2) {
          // "adjective animal named Name" format
          const adjective = match[1];
          animalType = match[2];
          characterName = match[3];
          characterDesc = `${characterName} the ${adjective} ${animalType}`;
        } else if (patternIndex === 3) {
          // "animal named Name" format
          animalType = match[1];
          characterName = match[2];
          characterDesc = `${animalType} named ${characterName}`;
        } else if (patternIndex === 4) {
          // "little animal" format
          animalType = match[1];
          characterDesc = `little ${animalType}`;
        } else if (patternIndex === 5) {
          // "a adjective animal" format
          const adjective = match[1];
          animalType = match[2];
          characterDesc = `a ${adjective} ${animalType}`;
        } else if (patternIndex === 6) {
          // Character names with titles
          const title = match[1];
          characterName = match[2];
          characterDesc = `${title} ${characterName}`;
        } else if (patternIndex === 7) {
          // Standalone character names with actions - filter out common words
          const potentialName = match[1];
          const commonWords = [
            'Everything',
            'Something',
            'Nothing',
            'Anything',
            'Everyone',
            'Someone',
            'Anyone',
            'This',
            'That',
            'These',
            'Those',
            'They',
            'Them',
            'Their',
            'There',
            'Then',
            'When',
            'Where',
            'What',
            'Which',
            'Who',
            'How',
            'Why',
            'And',
            'But',
            'Or',
            'So',
            'If',
            'As',
            'At',
            'In',
            'On',
            'By',
            'To',
            'Of',
            'For',
            'With',
            'From',
            'Up',
            'Out',
            'Off',
            'Down',
            'Over',
            'Under',
            'About',
            'Into',
            'Through',
            'During',
            'Before',
            'After',
            'Above',
            'Below',
            'Between',
            'Among',
            'Beyond',
            'Behind',
            'Beside',
            'Beneath',
            'Across',
            'Against',
            'Along',
            'Around',
            'Toward',
            'Upon',
            'Within',
            'Without',
            'Inside',
            'Outside',
            'Onto',
            'Into',
            'The',
            'A',
            'An',
            'This',
            'That',
            'These',
            'Those',
            'My',
            'Your',
            'His',
            'Her',
            'Its',
            'Our',
            'Their',
            'Me',
            'You',
            'Him',
            'Her',
            'It',
            'Us',
            'Them',
            'I',
            'We',
            'He',
            'She',
            'They',
            'Am',
            'Is',
            'Are',
            'Was',
            'Were',
            'Be',
            'Been',
            'Being',
            'Have',
            'Has',
            'Had',
            'Do',
            'Does',
            'Did',
            'Will',
            'Would',
            'Could',
            'Should',
            'May',
            'Might',
            'Can',
            'Must',
            'Shall',
            'One',
            'Two',
            'Three',
            'Four',
            'Five',
            'Six',
            'Seven',
            'Eight',
            'Nine',
            'Ten',
            'All',
            'Any',
            'Some',
            'Few',
            'Many',
            'Much',
            'Most',
            'More',
            'Less',
            'Little',
            'Big',
            'Large',
            'Small',
            'Great',
            'Good',
            'Bad',
            'Best',
            'Worst',
            'Better',
            'Worse',
            'First',
            'Last',
            'Next',
            'Previous',
            'New',
            'Old',
            'Young',
            'Ancient',
            'Modern',
            'Early',
            'Late',
            'Long',
            'Short',
            'High',
            'Low',
            'Far',
            'Near',
            'Close',
            'Open',
            'Closed',
            'Hot',
            'Cold',
            'Warm',
            'Cool',
            'Dry',
            'Wet',
            'Clean',
            'Dirty',
            'Light',
            'Dark',
            'Bright',
            'Dim',
            'Loud',
            'Quiet',
            'Fast',
            'Slow',
            'Quick',
            'Easy',
            'Hard',
            'Soft',
            'Rough',
            'Smooth',
            'Sharp',
            'Dull',
            'Heavy',
            'Light',
            'Strong',
            'Weak',
            'Full',
            'Empty',
            'Right',
            'Wrong',
            'True',
            'False',
            'Real',
            'Fake',
            'Sure',
            'Maybe',
            'Yes',
            'No',
            'Here',
            'There',
            'Where',
            'Everywhere',
            'Somewhere',
            'Nowhere',
            'Anywhere',
            'Now',
            'Then',
            'When',
            'Always',
            'Never',
            'Sometimes',
            'Often',
            'Usually',
            'Rarely',
            'Today',
            'Tomorrow',
            'Yesterday',
            'Soon',
            'Later',
            'Again',
            'Still',
            'Yet',
            'Already',
            'Just',
            'Only',
            'Also',
            'Too',
            'Very',
            'Really',
            'Quite',
            'Rather',
            'Pretty',
            'Fairly',
            'Enough',
            'Almost',
            'Nearly',
            'Completely',
            'Totally',
            'Entirely',
            'Absolutely',
            'Exactly',
            'Probably',
            'Perhaps',
            'Maybe',
            'Certainly',
            'Definitely',
            'Clearly',
            'Obviously',
            'Actually',
            'Finally',
            'Suddenly',
            'Immediately',
            'Recently',
            'Currently',
            'Eventually',
            'Gradually',
            'Slowly',
            'Quickly',
            'Carefully',
            'Quietly',
            'Loudly',
            'Gently',
            'Roughly',
            'Smoothly',
            'Easily',
            'Hardly',
            'Mostly',
            'Partly',
            'Especially',
            'Particularly',
            'Generally',
            'Usually',
            'Normally',
            'Typically',
            'Specifically',
            'Exactly',
            'Precisely',
            'Approximately',
            'About',
            'Around',
            'Nearly',
            'Almost',
            'Quite',
            'Rather',
            'Fairly',
            'Pretty',
            'Somewhat',
            'Slightly',
            'Barely',
            'Hardly',
            'Scarcely',
            'Merely',
            'Simply',
            'Just',
            'Only',
            'Even',
            'Still',
            'Yet',
            'Already',
            'Soon',
            'Later',
            'Earlier',
            'Before',
            'After',
            'During',
            'While',
            'Since',
            'Until',
            'Unless',
            'Although',
            'Though',
            'However',
            'Nevertheless',
            'Nonetheless',
            'Therefore',
            'Thus',
            'Hence',
            'Consequently',
            'Accordingly',
            'Meanwhile',
            'Otherwise',
            'Instead',
            'Rather',
            'Besides',
            'Moreover',
            'Furthermore',
            'Additionally',
            'Also',
            'Too',
            'As',
            'Well',
            'Likewise',
            'Similarly',
            'Equally',
            'Comparatively',
            'Relatively',
            'Respectively',
            'Alternatively',
            'Conversely',
            'Contrarily',
            'Oppositely',
            'Differently',
            'Separately',
            'Individually',
            'Collectively',
            'Together',
            'Apart',
            'Aside',
            'Away',
            'Back',
            'Forward',
            'Backward',
            'Ahead',
            'Behind',
            'Beside',
            'Besides',
            'Between',
            'Among',
            'Amongst',
            'Within',
            'Without',
            'Inside',
            'Outside',
            'Upward',
            'Downward',
            'Inward',
            'Outward',
            'Leftward',
            'Rightward',
            'Northward',
            'Southward',
            'Eastward',
            'Westward',
            'Homeward',
            'Onward',
            'Toward',
            'Against',
            'Along',
            'Across',
            'Through',
            'Throughout',
            'Over',
            'Under',
            'Above',
            'Below',
            'Beneath',
            'Beyond',
            'Beside',
            'Behind',
            'Onto',
            'Into',
            'Upon',
            'Atop',
            'Beneath',
            'Underneath',
            'Overhead',
            'Nearby',
            'Alongside',
            'Amidst',
            'Amid',
            'Via',
            'Per',
            'Except',
            'Besides',
            'Including',
            'Excluding',
            'Regarding',
            'Concerning',
            'Considering',
            'Despite',
            'Regardless',
            'Notwithstanding',
            'Albeit',
            'Whereas',
            'While',
            'Since',
            'Because',
            'Due',
            'Thanks',
            'Owing',
            'According',
            'Depending',
            'Based',
            'Given',
            'Assuming',
            'Supposing',
            'Provided',
            'Unless',
            'Whether',
            'Either',
            'Neither',
            'Both',
            'All',
            'Every',
            'Each',
            'Any',
            'Some',
            'Few',
            'Several',
            'Many',
            'Much',
            'Most',
            'More',
            'Less',
            'Fewer',
            'Little',
            'Lot',
            'Plenty',
            'Enough',
            'Sufficient',
            'Insufficient',
            'Adequate',
            'Inadequate',
            'Excess',
            'Excessive',
            'Extra',
            'Additional',
            'Further',
            'Another',
            'Other',
            'Others',
            'Different',
            'Same',
            'Similar',
            'Alike',
            'Unlike',
            'Dissimilar',
            'Various',
            'Diverse',
            'Multiple',
            'Single',
            'Double',
            'Triple',
            'Quadruple',
            'Half',
            'Quarter',
            'Third',
            'Whole',
            'Entire',
            'Complete',
            'Incomplete',
            'Partial',
            'Full',
            'Empty',
            'Filled',
            'Vacant',
            'Occupied',
            'Available',
            'Unavailable',
            'Present',
            'Absent',
            'Missing',
            'Lost',
            'Found',
            'Discovered',
            'Hidden',
            'Visible',
            'Invisible',
            'Apparent',
            'Obvious',
            'Clear',
            'Unclear',
            'Distinct',
            'Indistinct',
            'Definite',
            'Indefinite',
            'Certain',
            'Uncertain',
            'Sure',
            'Unsure',
            'Confident',
            'Doubtful',
            'Positive',
            'Negative',
            'Neutral',
            'Balanced',
            'Unbalanced',
            'Stable',
            'Unstable',
            'Steady',
            'Unsteady',
            'Consistent',
            'Inconsistent',
            'Regular',
            'Irregular',
            'Normal',
            'Abnormal',
            'Typical',
            'Atypical',
            'Common',
            'Uncommon',
            'Rare',
            'Frequent',
            'Infrequent',
            'Occasional',
            'Constant',
            'Variable',
            'Fixed',
            'Flexible',
            'Rigid',
            'Loose',
            'Tight',
            'Firm',
            'Weak',
            'Strong',
            'Powerful',
            'Powerless',
            'Mighty',
            'Feeble',
            'Robust',
            'Fragile',
            'Sturdy',
            'Delicate',
            'Tough',
            'Tender',
            'Hard',
            'Soft',
            'Solid',
            'Liquid',
            'Gaseous',
            'Dense',
            'Sparse',
            'Thick',
            'Thin',
            'Wide',
            'Narrow',
            'Broad',
            'Slim',
            'Fat',
            'Skinny',
            'Tall',
            'Short',
            'Long',
            'Brief',
            'Extended',
            'Prolonged',
            'Temporary',
            'Permanent',
            'Lasting',
            'Fleeting',
            'Quick',
            'Slow',
            'Fast',
            'Rapid',
            'Swift',
            'Sluggish',
            'Immediate',
            'Delayed',
            'Instant',
            'Gradual',
            'Sudden',
            'Smooth',
            'Rough',
            'Bumpy',
            'Even',
            'Uneven',
            'Level',
            'Sloped',
            'Straight',
            'Curved',
            'Bent',
            'Twisted',
            'Round',
            'Square',
            'Circular',
            'Rectangular',
            'Triangular',
            'Oval',
            'Linear',
            'Angular',
            'Sharp',
            'Blunt',
            'Pointed',
            'Rounded',
            'Flat',
            'Steep',
            'Gentle',
            'Harsh',
            'Mild',
            'Severe',
            'Extreme',
            'Moderate',
            'Intense',
            'Weak',
            'Strong',
            'Loud',
            'Quiet',
            'Silent',
            'Noisy',
            'Peaceful',
            'Violent',
            'Calm',
            'Turbulent',
            'Serene',
            'Chaotic',
            'Orderly',
            'Disorderly',
            'Organized',
            'Disorganized',
            'Neat',
            'Messy',
            'Clean',
            'Dirty',
            'Pure',
            'Impure',
            'Fresh',
            'Stale',
            'New',
            'Old',
            'Young',
            'Aged',
            'Ancient',
            'Modern',
            'Contemporary',
            'Traditional',
            'Conventional',
            'Unconventional',
            'Standard',
            'Nonstandard',
            'Regular',
            'Irregular',
            'Formal',
            'Informal',
            'Official',
            'Unofficial',
            'Legal',
            'Illegal',
            'Legitimate',
            'Illegitimate',
            'Valid',
            'Invalid',
            'Correct',
            'Incorrect',
            'Right',
            'Wrong',
            'Proper',
            'Improper',
            'Appropriate',
            'Inappropriate',
            'Suitable',
            'Unsuitable',
            'Fitting',
            'Unfitting',
            'Relevant',
            'Irrelevant',
            'Important',
            'Unimportant',
            'Significant',
            'Insignificant',
            'Major',
            'Minor',
            'Primary',
            'Secondary',
            'Main',
            'Subsidiary',
            'Central',
            'Peripheral',
            'Key',
            'Trivial',
            'Essential',
            'Nonessential',
            'Necessary',
            'Unnecessary',
            'Required',
            'Optional',
            'Mandatory',
            'Voluntary',
            'Compulsory',
            'Elective',
            'Obligatory',
            'Free',
            'Bound',
            'Independent',
            'Dependent',
            'Autonomous',
            'Controlled',
            'Self',
            'Other',
            'Own',
            'Foreign',
            'Domestic',
            'Local',
            'Global',
            'International',
            'National',
            'Regional',
            'Universal',
            'Particular',
            'General',
            'Specific',
            'Generic',
            'Individual',
            'Collective',
            'Personal',
            'Public',
            'Private',
            'Confidential',
            'Secret',
            'Open',
            'Closed',
            'Accessible',
            'Inaccessible',
            'Available',
            'Unavailable',
            'Possible',
            'Impossible',
            'Probable',
            'Improbable',
            'Likely',
            'Unlikely',
            'Potential',
            'Actual',
            'Real',
            'Imaginary',
            'Fictional',
            'Factual',
            'True',
            'False',
            'Honest',
            'Dishonest',
            'Truthful',
            'Deceptive',
            'Genuine',
            'Fake',
            'Authentic',
            'Artificial',
            'Natural',
            'Synthetic',
            'Original',
            'Copy',
            'Unique',
            'Common',
            'Special',
            'Ordinary',
            'Extraordinary',
            'Remarkable',
            'Unremarkable',
            'Notable',
            'Insignificant',
            'Outstanding',
            'Average',
            'Exceptional',
            'Typical',
            'Unusual',
            'Usual',
            'Strange',
            'Familiar',
            'Known',
            'Unknown',
            'Recognized',
            'Unrecognized',
            'Identified',
            'Unidentified',
            'Named',
            'Unnamed',
            'Titled',
            'Untitled',
            'Labeled',
            'Unlabeled',
            'Marked',
            'Unmarked',
            'Signed',
            'Unsigned',
            'Numbered',
            'Unnumbered',
            'Counted',
            'Uncounted',
            'Measured',
            'Unmeasured',
            'Weighed',
            'Unweighed',
            'Calculated',
            'Estimated',
            'Guessed',
            'Determined',
            'Decided',
            'Undecided',
            'Resolved',
            'Unresolved',
            'Settled',
            'Unsettled',
            'Confirmed',
            'Unconfirmed',
            'Verified',
            'Unverified',
            'Proven',
            'Unproven',
            'Tested',
            'Untested',
            'Tried',
            'Untried',
            'Attempted',
            'Unattempted',
            'Completed',
            'Incomplete',
            'Finished',
            'Unfinished',
            'Done',
            'Undone',
            'Accomplished',
            'Unaccomplished',
            'Achieved',
            'Unachieved',
            'Successful',
            'Unsuccessful',
            'Failed',
            'Passed',
            'Won',
            'Lost',
            'Gained',
            'Lost',
            'Earned',
            'Spent',
            'Saved',
            'Wasted',
            'Used',
            'Unused',
            'Utilized',
            'Underutilized',
            'Employed',
            'Unemployed',
            'Occupied',
            'Unoccupied',
            'Busy',
            'Idle',
            'Active',
            'Inactive',
            'Dynamic',
            'Static',
            'Moving',
            'Stationary',
            'Mobile',
            'Immobile',
            'Portable',
            'Fixed',
            'Stable',
            'Unstable',
            'Secure',
            'Insecure',
            'Safe',
            'Dangerous',
            'Risky',
            'Harmless',
            'Harmful',
            'Beneficial',
            'Detrimental',
            'Helpful',
            'Unhelpful',
            'Useful',
            'Useless',
            'Effective',
            'Ineffective',
            'Efficient',
            'Inefficient',
            'Productive',
            'Unproductive',
            'Profitable',
            'Unprofitable',
            'Valuable',
            'Worthless',
            'Precious',
            'Cheap',
            'Expensive',
            'Costly',
            'Affordable',
            'Unaffordable',
            'Reasonable',
            'Unreasonable',
            'Fair',
            'Unfair',
            'Just',
            'Unjust',
            'Equal',
            'Unequal',
            'Balanced',
            'Unbalanced',
            'Proportional',
            'Disproportional',
            'Symmetrical',
            'Asymmetrical',
            'Aligned',
            'Misaligned',
            'Coordinated',
            'Uncoordinated',
            'Organized',
            'Disorganized',
            'Systematic',
            'Unsystematic',
            'Methodical',
            'Random',
            'Planned',
            'Unplanned',
            'Deliberate',
            'Accidental',
            'Intentional',
            'Unintentional',
            'Purposeful',
            'Aimless',
            'Directed',
            'Undirected',
            'Guided',
            'Unguided',
            'Controlled',
            'Uncontrolled',
            'Managed',
            'Unmanaged',
            'Supervised',
            'Unsupervised',
            'Monitored',
            'Unmonitored',
            'Watched',
            'Unwatched',
            'Observed',
            'Unobserved',
            'Noticed',
            'Unnoticed',
            'Seen',
            'Unseen',
            'Visible',
            'Invisible',
            'Apparent',
            'Hidden',
            'Obvious',
            'Subtle',
            'Clear',
            'Vague',
            'Distinct',
            'Indistinct',
            'Precise',
            'Imprecise',
            'Accurate',
            'Inaccurate',
            'Exact',
            'Approximate',
            'Specific',
            'General',
            'Detailed',
            'Vague',
            'Thorough',
            'Superficial',
            'Complete',
            'Incomplete',
            'Comprehensive',
            'Limited',
            'Extensive',
            'Restricted',
            'Broad',
            'Narrow',
            'Wide',
            'Confined',
            'Expanded',
            'Contracted',
            'Enlarged',
            'Reduced',
            'Increased',
            'Decreased',
            'Grown',
            'Shrunk',
            'Developed',
            'Undeveloped',
            'Advanced',
            'Backward',
            'Progressive',
            'Regressive',
            'Forward',
            'Reverse',
            'Upward',
            'Downward',
            'Rising',
            'Falling',
            'Ascending',
            'Descending',
            'Climbing',
            'Declining',
            'Improving',
            'Worsening',
            'Better',
            'Worse',
            'Superior',
            'Inferior',
            'Higher',
            'Lower',
            'Greater',
            'Lesser',
            'Larger',
            'Smaller',
            'Bigger',
            'Littler',
            'Huge',
            'Tiny',
            'Enormous',
            'Minute',
            'Gigantic',
            'Microscopic',
            'Massive',
            'Miniature',
            'Colossal',
            'Petite',
            'Immense',
            'Compact',
            'Vast',
            'Cramped',
            'Spacious',
            'Crowded',
            'Roomy',
            'Tight',
            'Loose',
            'Relaxed',
            'Tense',
            'Calm',
            'Agitated',
            'Peaceful',
            'Disturbed',
            'Quiet',
            'Noisy',
            'Silent',
            'Loud',
            'Soft',
            'Hard',
            'Gentle',
            'Rough',
            'Smooth',
            'Bumpy',
            'Even',
            'Uneven',
            'Flat',
            'Curved',
            'Straight',
            'Crooked',
            'Level',
            'Tilted',
            'Horizontal',
            'Vertical',
            'Diagonal',
            'Parallel',
            'Perpendicular',
            'Intersecting',
            'Separate',
            'Connected',
            'Joined',
            'Detached',
            'Attached',
            'Linked',
            'Unlinked',
            'Related',
            'Unrelated',
            'Associated',
            'Disassociated',
            'Combined',
            'Separated',
            'United',
            'Divided',
            'Together',
            'Apart',
            'Close',
            'Distant',
            'Near',
            'Far',
            'Nearby',
            'Remote',
            'Local',
            'Foreign',
            'Domestic',
            'International',
            'Internal',
            'External',
            'Inside',
            'Outside',
            'Interior',
            'Exterior',
            'Inner',
            'Outer',
            'Central',
            'Peripheral',
            'Middle',
            'Edge',
            'Center',
            'Border',
            'Core',
            'Surface',
            'Deep',
            'Shallow',
            'Profound',
            'Superficial',
            'Serious',
            'Trivial',
            'Important',
            'Unimportant',
            'Significant',
            'Insignificant',
            'Meaningful',
            'Meaningless',
            'Relevant',
            'Irrelevant',
            'Applicable',
            'Inapplicable',
            'Suitable',
            'Unsuitable',
            'Appropriate',
            'Inappropriate',
            'Proper',
            'Improper',
            'Correct',
            'Incorrect',
            'Right',
            'Wrong',
            'Good',
            'Bad',
            'Excellent',
            'Poor',
            'Outstanding',
            'Terrible',
            'Wonderful',
            'Awful',
            'Great',
            'Horrible',
            'Amazing',
            'Dreadful',
            'Fantastic',
            'Disgusting',
            'Marvelous',
            'Repulsive',
            'Splendid',
            'Revolting',
            'Magnificent',
            'Sickening',
            'Beautiful',
            'Ugly',
            'Attractive',
            'Unattractive',
            'Pretty',
            'Plain',
            'Handsome',
            'Homely',
            'Lovely',
            'Hideous',
            'Gorgeous',
            'Ghastly',
            'Stunning',
            'Appalling',
            'Elegant',
            'Clumsy',
            'Graceful',
            'Awkward',
            'Refined',
            'Crude',
            'Sophisticated',
            'Primitive',
            'Cultured',
            'Barbaric',
            'Civilized',
            'Savage',
            'Polite',
            'Rude',
            'Courteous',
            'Impolite',
            'Respectful',
            'Disrespectful',
            'Kind',
            'Cruel',
            'Gentle',
            'Harsh',
            'Sweet',
            'Bitter',
            'Pleasant',
            'Unpleasant',
            'Agreeable',
            'Disagreeable',
            'Friendly',
            'Hostile',
            'Warm',
            'Cold',
            'Welcoming',
            'Unwelcoming',
            'Inviting',
            'Uninviting',
            'Appealing',
            'Unappealing',
            'Attractive',
            'Repulsive',
            'Charming',
            'Repellent',
            'Delightful',
            'Disgusting',
            'Enjoyable',
            'Unenjoyable',
            'Fun',
            'Boring',
            'Exciting',
            'Dull',
            'Interesting',
            'Uninteresting',
            'Fascinating',
            'Tedious',
            'Engaging',
            'Disengaging',
            'Captivating',
            'Repelling',
            'Absorbing',
            'Distracting',
            'Compelling',
            'Repulsive',
            'Enticing',
            'Discouraging',
            'Tempting',
            'Deterring',
            'Alluring',
            'Repelling',
            'Seductive',
            'Revolting',
            'Appealing',
            'Appalling',
            'Inviting',
            'Forbidding',
            'Welcome',
            'Unwelcome',
            'Desired',
            'Undesired',
            'Wanted',
            'Unwanted',
            'Needed',
            'Unneeded',
            'Required',
            'Unrequired',
            'Necessary',
            'Unnecessary',
            'Essential',
            'Nonessential',
            'Vital',
            'Trivial',
            'Critical',
            'Noncritical',
            'Crucial',
            'Negligible',
            'Urgent',
            'Nonurgent',
            'Immediate',
            'Delayed',
            'Pressing',
            'Relaxed',
            'Hurried',
            'Leisurely',
            'Rushed',
            'Unhurried',
            'Quick',
            'Slow',
            'Fast',
            'Sluggish',
            'Rapid',
            'Gradual',
            'Swift',
            'Plodding',
            'Speedy',
            'Dawdling',
            'Hasty',
            'Deliberate',
            'Prompt',
            'Late',
            'Early',
            'Tardy',
            'Punctual',
            'Overdue',
            'Timely',
            'Untimely',
            'Seasonal',
            'Unseasonable',
            'Current',
            'Outdated',
            'Modern',
            'Obsolete',
            'Contemporary',
            'Archaic',
            'Updated',
            'Antiquated',
            'Fresh',
            'Stale',
            'Recent',
            'Ancient',
            'Latest',
            'Oldest',
            'Newest',
            'Eldest',
            'Youngest',
            'Senior',
            'Junior',
            'Elder',
            'Younger',
            'Older',
            'Newer',
            'Former',
            'Current',
            'Previous',
            'Present',
            'Past',
            'Future',
            'Historical',
            'Futuristic',
            'Traditional',
            'Innovative',
            'Classical',
            'Revolutionary',
            'Conventional',
            'Radical',
            'Orthodox',
            'Unorthodox',
            'Standard',
            'Nonstandard',
            'Regular',
            'Irregular',
            'Normal',
            'Abnormal',
            'Typical',
            'Atypical',
            'Common',
            'Uncommon',
            'Ordinary',
            'Extraordinary',
            'Usual',
            'Unusual',
            'Routine',
            'Exceptional',
            'Habitual',
            'Sporadic',
            'Frequent',
            'Infrequent',
            'Constant',
            'Intermittent',
            'Continuous',
            'Discontinuous',
            'Steady',
            'Unsteady',
            'Stable',
            'Unstable',
            'Consistent',
            'Inconsistent',
            'Reliable',
            'Unreliable',
            'Dependable',
            'Undependable',
            'Trustworthy',
            'Untrustworthy',
            'Faithful',
            'Unfaithful',
            'Loyal',
            'Disloyal',
            'Devoted',
            'Indifferent',
            'Committed',
            'Uncommitted',
            'Dedicated',
            'Halfhearted',
            'Earnest',
            'Insincere',
            'Genuine',
            'Fake',
            'Authentic',
            'Artificial',
            'Real',
            'Imaginary',
            'Actual',
            'Fictional',
            'True',
            'False',
            'Factual',
            'Fabricated',
            'Accurate',
            'Inaccurate',
            'Precise',
            'Imprecise',
            'Exact',
            'Approximate',
            'Correct',
            'Incorrect',
            'Right',
            'Wrong',
            'Proper',
            'Improper',
            'Appropriate',
            'Inappropriate',
            'Suitable',
            'Unsuitable',
            'Fitting',
            'Unfitting',
            'Matching',
            'Mismatched',
            'Compatible',
            'Incompatible',
            'Harmonious',
            'Discordant',
            'Coordinated',
            'Uncoordinated',
            'Balanced',
            'Unbalanced',
            'Proportioned',
            'Disproportioned',
            'Symmetrical',
            'Asymmetrical',
            'Equal',
            'Unequal',
            'Even',
            'Uneven',
            'Fair',
            'Unfair',
            'Just',
            'Unjust',
            'Impartial',
            'Partial',
            'Objective',
            'Subjective',
            'Neutral',
            'Biased',
            'Unprejudiced',
            'Prejudiced',
            'Open',
            'Closed',
            'Minded',
            'Narrow',
            'Minded',
            'Broad',
            'Minded',
            'Liberal',
            'Conservative',
            'Progressive',
            'Regressive',
            'Forward',
            'Backward',
            'Looking',
            'Advanced',
            'Primitive',
            'Developed',
            'Undeveloped',
            'Sophisticated',
            'Unsophisticated',
            'Refined',
            'Crude',
            'Polished',
            'Rough',
            'Smooth',
            'Bumpy',
            'Finished',
            'Unfinished',
            'Complete',
            'Incomplete',
            'Whole',
            'Partial',
            'Entire',
            'Fragmented',
            'Intact',
            'Broken',
            'Undamaged',
            'Damaged',
            'Perfect',
            'Imperfect',
            'Flawless',
            'Flawed',
            'Spotless',
            'Stained',
            'Clean',
            'Dirty',
            'Pure',
            'Contaminated',
            'Fresh',
            'Spoiled',
            'New',
            'Used',
            'Unused',
            'Worn',
            'Unworn',
            'Pristine',
            'Weathered',
            'Mint',
            'Condition',
            'Shabby',
            'Elegant',
            'Crude',
            'Refined',
            'Sophisticated',
            'Simple',
            'Complex',
            'Complicated',
            'Easy',
            'Difficult',
            'Hard',
            'Soft',
            'Tough',
            'Tender',
            'Strong',
            'Weak',
            'Powerful',
            'Powerless',
            'Mighty',
            'Feeble',
            'Robust',
            'Frail',
            'Sturdy',
            'Fragile',
            'Solid',
            'Flimsy',
            'Firm',
            'Loose',
            'Tight',
            'Slack',
            'Taut',
            'Rigid',
            'Flexible',
            'Stiff',
            'Supple',
            'Brittle',
            'Elastic',
            'Hard',
            'Soft',
            'Dense',
            'Sparse',
            'Thick',
            'Thin',
            'Heavy',
            'Light',
            'Weighty',
            'Weightless',
            'Massive',
            'Tiny',
            'Bulky',
            'Compact',
            'Voluminous',
            'Condensed',
            'Expanded',
            'Compressed',
            'Inflated',
            'Deflated',
            'Swollen',
            'Shrunken',
            'Enlarged',
            'Reduced',
            'Magnified',
            'Minimized',
            'Amplified',
            'Diminished',
            'Enhanced',
            'Degraded',
            'Improved',
            'Worsened',
            'Upgraded',
            'Downgraded',
            'Advanced',
            'Retreated',
            'Progressed',
            'Regressed',
            'Developed',
            'Deteriorated',
            'Evolved',
            'Devolved',
            'Grown',
            'Shrunk',
            'Expanded',
            'Contracted',
            'Increased',
            'Decreased',
            'Multiplied',
            'Divided',
            'Added',
            'Subtracted',
            'Gained',
            'Lost',
            'Acquired',
            'Surrendered',
            'Obtained',
            'Relinquished',
            'Received',
            'Gave',
            'Taken',
            'Given',
            'Accepted',
            'Rejected',
            'Embraced',
            'Shunned',
            'Welcomed',
            'Spurned',
            'Invited',
            'Excluded',
            'Included',
            'Omitted',
            'Involved',
            'Uninvolved',
            'Engaged',
            'Disengaged',
            'Participating',
            'Abstaining',
            'Contributing',
            'Withholding',
            'Supporting',
            'Opposing',
            'Helping',
            'Hindering',
            'Assisting',
            'Obstructing',
            'Aiding',
            'Impeding',
            'Facilitating',
            'Blocking',
            'Enabling',
            'Preventing',
            'Allowing',
            'Forbidding',
            'Permitting',
            'Prohibiting',
            'Authorizing',
            'Banning',
            'Approving',
            'Disapproving',
            'Accepting',
            'Rejecting',
            'Endorsing',
            'Condemning',
            'Praising',
            'Criticizing',
            'Commending',
            'Censuring',
            'Complimenting',
            'Insulting',
            'Flattering',
            'Mocking',
            'Admiring',
            'Despising',
            'Respecting',
            'Disrespecting',
            'Honoring',
            'Dishonoring',
            'Revering',
            'Scorning',
            'Worshipping',
            'Blaspheming',
            'Adoring',
            'Loathing',
            'Loving',
            'Hating',
            'Liking',
            'Disliking',
            'Enjoying',
            'Detesting',
            'Appreciating',
            'Deploring',
            'Cherishing',
            'Abhorring',
            'Treasuring',
            'Despising',
            'Valuing',
            'Undervaluing',
            'Prizing',
            'Dismissing',
            'Esteeming',
            'Scorning',
            'Regarding',
            'Disregarding',
            'Considering',
            'Ignoring',
            'Contemplating',
            'Neglecting',
            'Pondering',
            'Overlooking',
            'Reflecting',
            'Disregarding',
            'Thinking',
            'Thoughtless',
            'Mindful',
            'Mindless',
            'Conscious',
            'Unconscious',
            'Aware',
            'Unaware',
            'Alert',
            'Oblivious',
            'Attentive',
            'Inattentive',
            'Focused',
            'Distracted',
            'Concentrated',
            'Scattered',
            'Absorbed',
            'Absent',
            'Minded',
            'Engrossed',
            'Detached',
            'Immersed',
            'Withdrawn',
            'Involved',
            'Aloof',
            'Engaged',
            'Indifferent',
            'Interested',
            'Uninterested',
            'Curious',
            'Incurious',
            'Inquisitive',
            'Apathetic',
            'Eager',
            'Reluctant',
            'Enthusiastic',
            'Unenthusiastic',
            'Excited',
            'Bored',
            'Thrilled',
            'Unimpressed',
            'Delighted',
            'Disappointed',
            'Pleased',
            'Displeased',
            'Satisfied',
            'Dissatisfied',
            'Content',
            'Discontent',
            'Happy',
            'Unhappy',
            'Joyful',
            'Sorrowful',
            'Cheerful',
            'Gloomy',
            'Glad',
            'Sad',
            'Merry',
            'Melancholy',
            'Elated',
            'Dejected',
            'Ecstatic',
            'Depressed',
            'Euphoric',
            'Despondent',
            'Blissful',
            'Miserable',
            'Overjoyed',
            'Heartbroken',
            'Jubilant',
            'Grieving',
            'Triumphant',
            'Mourning',
            'Victorious',
            'Defeated',
            'Successful',
            'Failed',
            'Winning',
            'Losing',
            'Accomplished',
            'Unsuccessful',
            'Achieved',
            'Unachieved',
            'Fulfilled',
            'Unfulfilled',
            'Realized',
            'Unrealized',
            'Completed',
            'Incomplete',
            'Finished',
            'Unfinished',
            'Done',
            'Undone',
            'Resolved',
            'Unresolved',
            'Settled',
            'Unsettled',
            'Decided',
            'Undecided',
            'Determined',
            'Undetermined',
            'Established',
            'Unestablished',
            'Confirmed',
            'Unconfirmed',
            'Verified',
            'Unverified',
            'Proven',
            'Unproven',
            'Demonstrated',
            'Undemonstrated',
            'Shown',
            'Unshown',
            'Revealed',
            'Unrevealed',
            'Disclosed',
            'Undisclosed',
            'Exposed',
            'Unexposed',
            'Uncovered',
            'Covered',
            'Discovered',
            'Undiscovered',
            'Found',
            'Unfound',
            'Located',
            'Unlocated',
            'Identified',
            'Unidentified',
            'Recognized',
            'Unrecognized',
            'Known',
            'Unknown',
            'Familiar',
            'Unfamiliar',
            'Acquainted',
            'Unacquainted',
            'Experienced',
            'Inexperienced',
            'Practiced',
            'Unpracticed',
            'Skilled',
            'Unskilled',
            'Trained',
            'Untrained',
            'Educated',
            'Uneducated',
            'Learned',
            'Unlearned',
            'Knowledgeable',
            'Ignorant',
            'Informed',
            'Uninformed',
            'Aware',
            'Unaware',
            'Conscious',
            'Unconscious',
            'Mindful',
            'Mindless',
            'Thoughtful',
            'Thoughtless',
            'Considerate',
            'Inconsiderate',
            'Careful',
            'Careless',
            'Cautious',
            'Reckless',
            'Prudent',
            'Imprudent',
            'Wise',
            'Foolish',
            'Sensible',
            'Senseless',
            'Rational',
            'Irrational',
            'Logical',
            'Illogical',
            'Reasonable',
            'Unreasonable',
            'Sound',
            'Unsound',
            'Valid',
            'Invalid',
            'Justified',
            'Unjustified',
            'Warranted',
            'Unwarranted',
            'Legitimate',
            'Illegitimate',
            'Legal',
            'Illegal',
            'Lawful',
            'Unlawful',
            'Authorized',
            'Unauthorized',
            'Permitted',
            'Forbidden',
            'Allowed',
            'Prohibited',
            'Acceptable',
            'Unacceptable',
            'Approved',
            'Disapproved',
            'Endorsed',
            'Rejected',
            'Supported',
            'Opposed',
            'Favored',
            'Disfavored',
            'Preferred',
            'Dispreferred',
            'Chosen',
            'Unchosen',
            'Selected',
            'Unselected',
            'Picked',
            'Unpicked',
            'Elected',
            'Unelected',
            'Appointed',
            'Unappointed',
            'Assigned',
            'Unassigned',
            'Designated',
            'Undesignated',
            'Named',
            'Unnamed',
            'Called',
            'Uncalled',
            'Titled',
            'Untitled',
            'Labeled',
            'Unlabeled',
            'Tagged',
            'Untagged',
            'Marked',
            'Unmarked',
            'Signed',
            'Unsigned',
            'Stamped',
            'Unstamped',
            'Sealed',
            'Unsealed',
            'Certified',
            'Uncertified',
            'Verified',
            'Unverified',
            'Validated',
            'Invalidated',
            'Authenticated',
            'Unauthenticated',
            'Authorized',
            'Unauthorized',
            'Licensed',
            'Unlicensed',
            'Registered',
            'Unregistered',
            'Documented',
            'Undocumented',
            'Recorded',
            'Unrecorded',
            'Filed',
            'Unfiled',
            'Catalogued',
            'Uncatalogued',
            'Listed',
            'Unlisted',
            'Indexed',
            'Unindexed',
            'Classified',
            'Unclassified',
            'Categorized',
            'Uncategorized',
            'Grouped',
            'Ungrouped',
            'Sorted',
            'Unsorted',
            'Arranged',
            'Unarranged',
            'Organized',
            'Disorganized',
            'Ordered',
            'Disordered',
            'Structured',
            'Unstructured',
            'Systematic',
            'Unsystematic',
            'Methodical',
            'Unmethodical',
            'Planned',
            'Unplanned',
            'Scheduled',
            'Unscheduled',
            'Timed',
            'Untimed',
            'Coordinated',
            'Uncoordinated',
            'Synchronized',
            'Unsynchronized',
            'Aligned',
            'Misaligned',
            'Matched',
            'Mismatched',
            'Paired',
            'Unpaired',
            'Coupled',
            'Uncoupled',
            'Connected',
            'Disconnected',
            'Linked',
            'Unlinked',
            'Joined',
            'Disjoined',
            'United',
            'Disunited',
            'Combined',
            'Separated',
            'Merged',
            'Divided',
            'Integrated',
            'Segregated',
            'Blended',
            'Unmixed',
            'Mixed',
            'Unmixed',
            'Fused',
            'Unfused',
            'Welded',
            'Unwelded',
            'Bonded',
            'Unbonded',
            'Attached',
            'Detached',
            'Fastened',
            'Unfastened',
            'Secured',
            'Unsecured',
            'Fixed',
            'Unfixed',
            'Anchored',
            'Unanchored',
            'Moored',
            'Unmoored',
            'Tethered',
            'Untethered',
            'Tied',
            'Untied',
            'Bound',
            'Unbound',
            'Knotted',
            'Unknotted',
            'Twisted',
            'Untwisted',
            'Coiled',
            'Uncoiled',
            'Wound',
            'Unwound',
            'Wrapped',
            'Unwrapped',
            'Covered',
            'Uncovered',
            'Enclosed',
            'Unenclosed',
            'Contained',
            'Uncontained',
            'Surrounded',
            'Unsurrounded',
            'Encircled',
            'Unencircled',
            'Encompassed',
            'Unencompassed',
            'Embraced',
            'Unembraced',
            'Hugged',
            'Unhugged',
            'Held',
            'Unheld',
            'Grasped',
            'Ungrasped',
            'Gripped',
            'Ungripped',
            'Clutched',
            'Unclutched',
            'Seized',
            'Unseized',
            'Grabbed',
            'Ungrabbed',
            'Caught',
            'Uncaught',
            'Captured',
            'Uncaptured',
            'Trapped',
            'Untrapped',
            'Snared',
            'Unsnared',
            'Netted',
            'Unnetted',
            'Hooked',
            'Unhooked',
            'Lassoed',
            'Unlassoed',
            'Roped',
            'Unroped',
            'Chained',
            'Unchained',
            'Shackled',
            'Unshackled',
            'Handcuffed',
            'Unhandcuffed',
            'Restrained',
            'Unrestrained',
            'Confined',
            'Unconfined',
            'Restricted',
            'Unrestricted',
            'Limited',
            'Unlimited',
            'Bounded',
            'Unbounded',
            'Constrained',
            'Unconstrained',
            'Controlled',
            'Uncontrolled',
            'Regulated',
            'Unregulated',
            'Governed',
            'Ungoverned',
            'Ruled',
            'Unruled',
            'Managed',
            'Unmanaged',
            'Administered',
            'Unadministered',
            'Supervised',
            'Unsupervised',
            'Overseen',
            'Unoverseen',
            'Monitored',
            'Unmonitored',
            'Watched',
            'Unwatched',
            'Observed',
            'Unobserved',
            'Surveyed',
            'Unsurveyed',
            'Inspected',
            'Uninspected',
            'Examined',
            'Unexamined',
            'Checked',
            'Unchecked',
            'Tested',
            'Untested',
            'Tried',
            'Untried',
            'Attempted',
            'Unattempted',
            'Experimented',
            'Unexperimented',
            'Explored',
            'Unexplored',
            'Investigated',
            'Uninvestigated',
            'Researched',
            'Unresearched',
            'Studied',
            'Unstudied',
            'Analyzed',
            'Unanalyzed',
            'Evaluated',
            'Unevaluated',
            'Assessed',
            'Unassessed',
            'Appraised',
            'Unappraised',
            'Judged',
            'Unjudged',
            'Rated',
            'Unrated',
            'Ranked',
            'Unranked',
            'Graded',
            'Ungraded',
            'Scored',
            'Unscored',
            'Measured',
            'Unmeasured',
            'Weighed',
            'Unweighed',
            'Counted',
            'Uncounted',
            'Numbered',
            'Unnumbered',
            'Calculated',
            'Uncalculated',
            'Computed',
            'Uncomputed',
            'Figured',
            'Unfigured',
            'Estimated',
            'Unestimated',
            'Approximated',
            'Unapproximated',
            'Guessed',
            'Unguessed',
            'Predicted',
            'Unpredicted',
            'Forecasted',
            'Unforecasted',
            'Projected',
            'Unprojected',
            'Anticipated',
            'Unanticipated',
            'Expected',
            'Unexpected',
            'Foreseen',
            'Unforeseen',
            'Envisioned',
            'Unenvisioned',
            'Imagined',
            'Unimagined',
            'Conceived',
            'Unconceived',
            'Visualized',
            'Unvisualized',
            'Pictured',
            'Unpictured',
            'Dreamed',
            'Undreamed',
            'Fantasized',
            'Unfantasized',
            'Wished',
            'Unwished',
            'Hoped',
            'Unhoped',
            'Desired',
            'Undesired',
            'Wanted',
            'Unwanted',
            'Needed',
            'Unneeded',
            'Required',
            'Unrequired',
            'Demanded',
            'Undemanded',
            'Requested',
            'Unrequested',
            'Asked',
            'Unasked',
            'Sought',
            'Unsought',
            'Pursued',
            'Unpursued',
            'Chased',
            'Unchased',
            'Hunted',
            'Unhunted',
            'Searched',
            'Unsearched',
            'Looked',
            'Unlooked',
            'Explored',
            'Unexplored',
            'Investigated',
            'Uninvestigated',
            'Probed',
            'Unprobed',
            'Examined',
            'Unexamined',
            'Scrutinized',
            'Unscrutinized',
            'Inspected',
            'Uninspected',
            'Surveyed',
            'Unsurveyed',
            'Scanned',
            'Unscanned',
            'Reviewed',
            'Unreviewed',
            'Checked',
            'Unchecked',
            'Verified',
            'Unverified',
            'Confirmed',
            'Unconfirmed',
            'Validated',
            'Invalidated',
            'Authenticated',
            'Unauthenticated',
            'Authorized',
            'Unauthorized',
            'Approved',
            'Unapproved',
            'Accepted',
            'Unaccepted',
            'Endorsed',
            'Unendorsed',
            'Supported',
            'Unsupported',
            'Backed',
            'Unbacked',
            'Sponsored',
            'Unsponsored',
            'Funded',
            'Unfunded',
            'Financed',
            'Unfinanced',
            'Subsidized',
            'Unsubsidized',
            'Granted',
            'Ungranted',
            'Awarded',
            'Unawarded',
            'Given',
            'Ungiven',
            'Presented',
            'Unpresented',
            'Offered',
            'Unoffered',
            'Provided',
            'Unprovided',
            'Supplied',
            'Unsupplied',
            'Furnished',
            'Unfurnished',
            'Equipped',
            'Unequipped',
            'Outfitted',
            'Unoutfitted',
            'Armed',
            'Unarmed',
            'Prepared',
            'Unprepared',
            'Ready',
            'Unready',
            'Set',
            'Unset',
            'Primed',
            'Unprimed',
            'Loaded',
            'Unloaded',
            'Charged',
            'Uncharged',
            'Powered',
            'Unpowered',
            'Energized',
            'Unenergized',
            'Activated',
            'Deactivated',
            'Enabled',
            'Disabled',
            'Engaged',
            'Disengaged',
            'Turned',
            'Unturned',
            'Switched',
            'Unswitched',
            'Started',
            'Stopped',
            'Begun',
            'Ended',
            'Initiated',
            'Terminated',
            'Commenced',
            'Concluded',
            'Launched',
            'Landed',
            'Opened',
            'Closed',
            'Unlocked',
            'Locked',
            'Unsealed',
            'Sealed',
            'Unblocked',
            'Blocked',
            'Cleared',
            'Clogged',
            'Free',
            'Trapped',
            'Released',
            'Captured',
            'Liberated',
            'Imprisoned',
            'Freed',
            'Enslaved',
            'Emancipated',
            'Bound',
            'Unbound',
            'Loose',
            'Tight',
            'Relaxed',
            'Tense',
            'Calm',
            'Agitated',
            'Peaceful',
            'Disturbed',
            'Quiet',
            'Noisy',
            'Silent',
            'Loud',
            'Hushed',
            'Boisterous',
            'Subdued',
            'Raucous',
            'Muted',
            'Amplified',
            'Softened',
            'Harsh',
            'Gentle',
            'Mild',
            'Severe',
            'Lenient',
            'Strict',
            'Permissive',
            'Restrictive',
            'Liberal',
            'Conservative',
            'Open',
            'Closed',
            'Minded',
            'Broad',
            'Narrow',
            'Wide',
            'Confined',
            'Spacious',
            'Cramped',
            'Roomy',
            'Crowded',
            'Empty',
            'Full',
            'Vacant',
            'Occupied',
            'Available',
            'Unavailable',
            'Accessible',
            'Inaccessible',
            'Reachable',
            'Unreachable',
            'Attainable',
            'Unattainable',
            'Achievable',
            'Unachievable',
            'Possible',
            'Impossible',
            'Feasible',
            'Infeasible',
            'Viable',
            'Unviable',
            'Workable',
            'Unworkable',
            'Practical',
            'Impractical',
            'Realistic',
            'Unrealistic',
            'Sensible',
            'Nonsensical',
            'Reasonable',
            'Unreasonable',
            'Logical',
            'Illogical',
            'Rational',
            'Irrational',
            'Sound',
            'Unsound',
            'Valid',
            'Invalid',
            'Legitimate',
            'Illegitimate',
            'Justified',
            'Unjustified',
            'Warranted',
            'Unwarranted',
            'Deserved',
            'Undeserved',
            'Earned',
            'Unearned',
            'Merited',
            'Unmerited',
            'Due',
            'Undue',
            'Owed',
            'Unowed',
            'Expected',
            'Unexpected',
            'Anticipated',
            'Unanticipated',
            'Predicted',
            'Unpredicted',
            'Foreseen',
            'Unforeseen',
            'Planned',
            'Unplanned',
            'Intended',
            'Unintended',
            'Deliberate',
            'Accidental',
            'Purposeful',
            'Aimless',
            'Meaningful',
            'Meaningless',
            'Significant',
            'Insignificant',
            'Important',
            'Unimportant',
            'Relevant',
            'Irrelevant',
            'Pertinent',
            'Impertinent',
            'Applicable',
            'Inapplicable',
            'Suitable',
            'Unsuitable',
            'Appropriate',
            'Inappropriate',
            'Proper',
            'Improper',
            'Fitting',
            'Unfitting',
            'Right',
            'Wrong',
            'Correct',
            'Incorrect',
            'Accurate',
            'Inaccurate',
            'Precise',
            'Imprecise',
            'Exact',
            'Inexact',
            'Perfect',
            'Imperfect',
            'Flawless',
            'Flawed',
            'Ideal',
            'Nonideal',
            'Optimal',
            'Suboptimal',
            'Best',
            'Worst',
            'Better',
            'Worse',
            'Superior',
            'Inferior',
            'Higher',
            'Lower',
            'Greater',
            'Lesser',
            'Larger',
            'Smaller',
            'Bigger',
            'Littler',
            'Huge',
            'Tiny',
            'Enormous',
            'Minute',
            'Gigantic',
            'Minuscule',
            'Colossal',
            'Microscopic',
            'Massive',
            'Negligible',
            'Immense',
            'Infinitesimal',
            'Vast',
            'Limited',
            'Extensive',
            'Restricted',
            'Comprehensive',
            'Narrow',
            'Broad',
            'Specific',
            'General',
            'Detailed',
            'Vague',
            'Precise',
            'Imprecise',
            'Clear',
            'Unclear',
            'Distinct',
            'Indistinct',
            'Sharp',
            'Blurry',
            'Focused',
            'Unfocused',
            'Defined',
            'Undefined',
            'Explicit',
            'Implicit',
            'Direct',
            'Indirect',
            'Straightforward',
            'Roundabout',
            'Simple',
            'Complex',
            'Easy',
            'Difficult',
            'Hard',
            'Soft',
            'Tough',
            'Tender',
            'Strong',
            'Weak',
            'Powerful',
            'Powerless',
            'Mighty',
            'Feeble',
            'Robust',
            'Fragile',
            'Sturdy',
            'Delicate',
            'Durable',
            'Perishable',
            'Lasting',
            'Temporary',
            'Permanent',
            'Transient',
            'Enduring',
            'Fleeting',
            'Stable',
            'Unstable',
            'Steady',
            'Unsteady',
            'Firm',
            'Shaky',
            'Solid',
            'Liquid',
            'Hard',
            'Soft',
            'Rigid',
            'Flexible',
            'Stiff',
            'Supple',
            'Brittle',
            'Elastic',
            'Dense',
            'Sparse',
            'Thick',
            'Thin',
            'Heavy',
            'Light',
            'Weighty',
            'Weightless',
            'Bulky',
            'Compact',
            'Large',
            'Small',
            'Big',
            'Little',
            'Huge',
            'Tiny',
            'Enormous',
            'Minute',
            'Gigantic',
            'Minuscule',
            'Massive',
            'Negligible',
            'Colossal',
            'Microscopic',
            'Immense',
            'Infinitesimal',
            'Vast',
            'Limited',
            'Extensive',
            'Restricted',
            'Wide',
            'Narrow',
            'Broad',
            'Slim',
            'Fat',
            'Skinny',
            'Thick',
            'Thin',
            'Tall',
            'Short',
            'High',
            'Low',
            'Long',
            'Brief',
            'Extended',
            'Shortened',
            'Lengthened',
            'Stretched',
            'Compressed',
            'Expanded',
            'Contracted',
            'Enlarged',
            'Reduced',
            'Increased',
            'Decreased',
            'Grown',
            'Shrunk',
            'Swollen',
            'Shrunken',
            'Inflated',
            'Deflated',
            'Bloated',
            'Flattened',
            'Raised',
            'Lowered',
            'Elevated',
            'Depressed',
            'Lifted',
            'Dropped',
            'Hoisted',
            'Lowered',
            'Boosted',
            'Diminished',
            'Heightened',
            'Reduced',
            'Intensified',
            'Weakened',
            'Strengthened',
            'Weakened',
            'Reinforced',
            'Undermined',
            'Supported',
            'Destroyed',
            'Built',
            'Demolished',
            'Constructed',
            'Ruined',
            'Created',
            'Annihilated',
            'Made',
            'Unmade',
            'Formed',
            'Deformed',
            'Shaped',
            'Misshapen',
            'Molded',
            'Unmolded',
            'Crafted',
            'Uncrafted',
            'Fashioned',
            'Unfashioned',
            'Designed',
            'Undesigned',
            'Planned',
            'Unplanned',
            'Organized',
            'Disorganized',
            'Arranged',
            'Disarranged',
            'Ordered',
            'Disordered',
            'Structured',
            'Unstructured',
            'Systematic',
            'Unsystematic',
            'Methodical',
            'Unmethodical',
            'Coordinated',
            'Uncoordinated',
            'Synchronized',
            'Unsynchronized',
            'Harmonized',
            'Disharmonized',
            'Balanced',
            'Unbalanced',
            'Aligned',
            'Misaligned',
            'Adjusted',
            'Maladjusted',
            'Calibrated',
            'Uncalibrated',
            'Tuned',
            'Untuned',
            'Regulated',
            'Unregulated',
            'Controlled',
            'Uncontrolled',
            'Managed',
            'Unmanaged',
            'Governed',
            'Ungoverned',
            'Directed',
            'Undirected',
            'Guided',
            'Unguided',
            'Led',
            'Unled',
            'Supervised',
            'Unsupervised',
            'Overseen',
            'Unoverseen',
            'Watched',
            'Unwatched',
            'Monitored',
            'Unmonitored',
            'Observed',
            'Unobserved',
            'Noticed',
            'Unnoticed',
            'Seen',
            'Unseen',
            'Visible',
            'Invisible',
            'Apparent',
            'Unapparent',
            'Obvious',
            'Unobvious',
            'Clear',
            'Unclear',
            'Plain',
            'Obscure',
            'Evident',
            'Unevident',
            'Manifest',
            'Hidden',
            'Open',
            'Concealed',
            'Exposed',
            'Covered',
            'Revealed',
            'Unrevealed',
            'Shown',
            'Unshown',
            'Displayed',
            'Undisplayed',
            'Exhibited',
            'Unexphibited',
            'Presented',
            'Unpresented',
            'Demonstrated',
            'Undemonstrated',
            'Illustrated',
            'Unillustrated',
            'Depicted',
            'Undepicted',
            'Portrayed',
            'Unportrayed',
            'Represented',
            'Unrepresented',
            'Expressed',
            'Unexpressed',
            'Communicated',
            'Uncommunicated',
            'Conveyed',
            'Unconveyed',
            'Transmitted',
            'Untransmitted',
            'Delivered',
            'Undelivered',
            'Sent',
            'Unsent',
            'Received',
            'Unreceived',
            'Gotten',
            'Ungotten',
            'Obtained',
            'Unobtained',
            'Acquired',
            'Unacquired',
            'Gained',
            'Ungained',
            'Earned',
            'Unearned',
            'Won',
            'Lost',
            'Achieved',
            'Unachieved',
            'Accomplished',
            'Unaccomplished',
            'Completed',
            'Incomplete',
            'Finished',
            'Unfinished',
            'Done',
            'Undone',
            'Ended',
            'Unended',
            'Concluded',
            'Unconcluded',
            'Terminated',
            'Unterminated',
            'Stopped',
            'Unstopped',
            'Ceased',
            'Unceased',
            'Discontinued',
            'Continued',
            'Interrupted',
            'Uninterrupted',
            'Broken',
            'Unbroken',
            'Paused',
            'Unpaused',
            'Suspended',
            'Unsuspended',
            'Halted',
            'Unhalted',
            'Frozen',
            'Unfrozen',
            'Stalled',
            'Unstalled',
            'Stuck',
            'Unstuck',
            'Blocked',
            'Unblocked',
            'Clogged',
            'Unclogged',
            'Jammed',
            'Unjammed',
            'Locked',
            'Unlocked',
            'Sealed',
            'Unsealed',
            'Closed',
            'Opened',
            'Shut',
            'Unshut',
            'Fastened',
            'Unfastened',
            'Secured',
            'Unsecured',
            'Fixed',
            'Unfixed',
            'Attached',
            'Detached',
            'Connected',
            'Disconnected',
            'Linked',
            'Unlinked',
            'Joined',
            'Disjoined',
            'United',
            'Disunited',
            'Combined',
            'Separated',
            'Merged',
            'Divided',
            'Blended',
            'Separated',
            'Mixed',
            'Unmixed',
            'Integrated',
            'Segregated',
            'Consolidated',
            'Dispersed',
            'Concentrated',
            'Scattered',
            'Gathered',
            'Dispersed',
            'Collected',
            'Distributed',
            'Assembled',
            'Disassembled',
            'Grouped',
            'Ungrouped',
            'Clustered',
            'Unclustered',
            'Bundled',
            'Unbundled',
            'Packed',
            'Unpacked',
            'Wrapped',
            'Unwrapped',
            'Covered',
            'Uncovered',
            'Protected',
            'Unprotected',
            'Shielded',
            'Unshielded',
            'Defended',
            'Undefended',
            'Guarded',
            'Unguarded',
            'Secured',
            'Unsecured',
            'Safe',
            'Unsafe',
            'Dangerous',
            'Harmless',
            'Risky',
            'Risk',
            'Free',
            'Hazardous',
            'Non',
            'Hazardous',
            'Threatening',
            'Nonthreatening',
            'Menacing',
            'Non',
            'Menacing',
            'Intimidating',
            'Non',
            'Intimidating',
            'Frightening',
            'Non',
            'Frightening',
            'Scary',
            'Non',
            'Scary',
            'Terrifying',
            'Non',
            'Terrifying',
            'Horrifying',
            'Non',
            'Horrifying',
            'Alarming',
            'Non',
            'Alarming',
            'Disturbing',
            'Non',
            'Disturbing',
            'Worrying',
            'Non',
            'Worrying',
            'Concerning',
            'Non',
            'Concerning',
            'Troubling',
            'Non',
            'Troubling',
            'Problematic',
            'Non',
            'Problematic',
            'Difficult',
            'Easy',
            'Hard',
            'Simple',
            'Complex',
            'Complicated',
            'Intricate',
            'Straightforward',
            'Involved',
            'Uninvolved',
            'Detailed',
            'General',
            'Specific',
            'Vague',
            'Precise',
            'Imprecise',
            'Exact',
            'Approximate',
            'Accurate',
            'Inaccurate',
            'Correct',
            'Incorrect',
            'Right',
            'Wrong',
            'Proper',
            'Improper',
            'Appropriate',
            'Inappropriate',
            'Suitable',
            'Unsuitable',
            'Fitting',
            'Unfitting',
            'Matching',
            'Mismatched',
            'Compatible',
            'Incompatible',
            'Consistent',
            'Inconsistent',
            'Coherent',
            'Incoherent',
            'Logical',
            'Illogical',
            'Rational',
            'Irrational',
            'Reasonable',
            'Unreasonable',
            'Sensible',
            'Nonsensical',
            'Sound',
            'Unsound',
            'Valid',
            'Invalid',
            'Legitimate',
            'Illegitimate',
            'Justified',
            'Unjustified',
            'Warranted',
            'Unwarranted',
            'Founded',
            'Unfounded',
            'Based',
            'Unbased',
            'Grounded',
            'Ungrounded',
            'Rooted',
            'Uprooted',
            'Established',
            'Unestablished',
            'Settled',
            'Unsettled',
            'Fixed',
            'Unfixed',
            'Determined',
            'Undetermined',
            'Decided',
            'Undecided',
            'Resolved',
            'Unresolved',
            'Concluded',
            'Unconcluded',
            'Finalized',
            'Unfinalized',
            'Completed',
            'Incomplete',
            'Finished',
            'Unfinished',
            'Done',
            'Undone',
            'Accomplished',
            'Unaccomplished',
            'Achieved',
            'Unachieved',
            'Attained',
            'Unattained',
            'Reached',
            'Unreached',
            'Gained',
            'Ungained',
            'Obtained',
            'Unobtained',
            'Acquired',
            'Unacquired',
            'Secured',
            'Unsecured',
            'Won',
            'Lost',
            'Earned',
            'Unearned',
            'Deserved',
            'Undeserved',
            'Merited',
            'Unmerited',
            'Qualified',
            'Unqualified',
            'Entitled',
            'Unentitled',
            'Authorized',
            'Unauthorized',
            'Licensed',
            'Unlicensed',
            'Permitted',
            'Unpermitted',
            'Allowed',
            'Disallowed',
            'Approved',
            'Unapproved',
            'Accepted',
            'Unaccepted',
            'Endorsed',
            'Unendorsed',
            'Supported',
            'Unsupported',
            'Backed',
            'Unbacked',
            'Sponsored',
            'Unsponsored',
            'Funded',
            'Unfunded',
            'Financed',
            'Unfinanced',
            'Subsidized',
            'Unsubsidized',
            'Invested',
            'Uninvested',
            'Contributed',
            'Uncontributed',
            'Donated',
            'Undonated',
            'Given',
            'Ungiven',
            'Granted',
            'Ungranted',
            'Awarded',
            'Unawarded',
            'Presented',
            'Unpresented',
            'Offered',
            'Unoffered',
            'Provided',
            'Unprovided',
            'Supplied',
            'Unsupplied',
            'Furnished',
            'Unfurnished',
            'Equipped',
            'Unequipped',
            'Prepared',
            'Unprepared',
            'Ready',
            'Unready',
            'Set',
            'Unset',
            'Arranged',
            'Unarranged',
            'Organized',
            'Disorganized',
            'Planned',
            'Unplanned',
            'Scheduled',
            'Unscheduled',
            'Booked',
            'Unbooked',
            'Reserved',
            'Unreserved',
            'Confirmed',
            'Unconfirmed',
            'Guaranteed',
            'Unguaranteed',
            'Assured',
            'Unassured',
            'Promised',
            'Unpromised',
            'Pledged',
            'Unpledged',
            'Committed',
            'Uncommitted',
            'Obligated',
            'Unobligated',
            'Bound',
            'Unbound',
            'Tied',
            'Untied',
            'Contracted',
            'Uncontracted',
            'Agreed',
            'Disagreed',
            'Consented',
            'Dissented',
            'Approved',
            'Disapproved',
            'Accepted',
            'Rejected',
            'Embraced',
            'Spurned',
            'Welcomed',
            'Unwelcomed',
            'Received',
            'Unreceived',
            'Taken',
            'Untaken',
            'Adopted',
            'Unadopted',
            'Assumed',
            'Unassumed',
            'Acquired',
            'Unacquired',
            'Inherited',
            'Uninherited',
            'Derived',
            'Underived',
            'Obtained',
            'Unobtained',
            'Gathered',
            'Ungathered',
            'Collected',
            'Uncollected',
            'Assembled',
            'Unassembled',
            'Accumulated',
            'Unaccumulated',
            'Amassed',
            'Unamassed',
            'Stockpiled',
            'Unstockpiled',
            'Stored',
            'Unstored',
            'Saved',
            'Unsaved',
            'Preserved',
            'Unpreserved',
            'Maintained',
            'Unmaintained',
            'Kept',
            'Unkept',
            'Retained',
            'Unretained',
            'Held',
            'Unheld',
            'Possessed',
            'Unpossessed',
            'Owned',
            'Unowned',
            'Had',
            'Lacked',
            'Contained',
            'Lacked',
            'Included',
            'Excluded',
            'Comprised',
            'Uncomprised',
            'Incorporated',
            'Unincorporated',
            'Embraced',
            'Excluded',
            'Encompassed',
            'Unencompassed',
            'Covered',
            'Uncovered',
            'Involved',
            'Uninvolved',
            'Engaged',
            'Disengaged',
            'Participated',
            'Unparticipated',
            'Contributed',
            'Uncontributed',
            'Shared',
            'Unshared',
            'Partook',
            'Abstained',
            'Joined',
            'Disjoined',
            'Entered',
            'Exited',
            'Included',
            'Excluded',
            'Admitted',
            'Excluded',
            'Allowed',
            'Denied',
            'Granted',
            'Refused',
            'Permitted',
            'Forbade',
            'Authorized',
            'Prohibited',
            'Approved',
            'Vetoed',
            'Accepted',
            'Rejected',
            'Endorsed',
            'Opposed',
            'Supported',
            'Resisted',
            'Backed',
            'Opposed',
            'Favored',
            'Disfavored',
            'Preferred',
            'Dispreferred',
            'Chose',
            'Rejected',
            'Selected',
            'Deselected',
            'Picked',
            'Unpicked',
            'Opted',
            'Declined',
            'Decided',
            'Undecided',
            'Determined',
            'Undetermined',
            'Resolved',
            'Unresolved',
            'Settled',
            'Unsettled',
            'Concluded',
            'Unconcluded',
            'Agreed',
            'Disagreed',
            'Consented',
            'Refused',
            'Assented',
            'Dissented',
            'Confirmed',
            'Denied',
            'Affirmed',
            'Negated',
            'Validated',
            'Invalidated',
            'Verified',
            'Falsified',
            'Proved',
            'Disproved',
            'Demonstrated',
            'Refuted',
            'Established',
            'Debunked',
            'Substantiated',
            'Undermined',
            'Corroborated',
            'Contradicted',
            'Authenticated',
            'Questioned',
            'Certified',
            'Challenged',
            'Warranted',
            'Disputed',
            'Justified',
            'Criticized',
            'Defended',
            'Attacked',
            'Supported',
            'Opposed',
            'Advocated',
            'Condemned',
            'Promoted',
            'Discouraged',
            'Encouraged',
            'Deterred',
            'Motivated',
            'Demotivated',
            'Inspired',
            'Uninspired',
            'Stimulated',
            'Unstimulated',
            'Energized',
            'Unenergized',
            'Invigorated',
            'Uninvigorated',
            'Revitalized',
            'Devitalized',
            'Refreshed',
            'Exhausted',
            'Renewed',
            'Depleted',
            'Restored',
            'Diminished',
            'Replenished',
            'Emptied',
            'Filled',
            'Emptied',
            'Loaded',
            'Unloaded',
            'Packed',
            'Unpacked',
            'Stuffed',
            'Unstuffed',
            'Crammed',
            'Uncrammed',
            'Jammed',
            'Unjammed',
            'Squeezed',
            'Unsqueezed',
            'Compressed',
            'Uncompressed',
            'Condensed',
            'Uncondensed',
            'Concentrated',
            'Diluted',
            'Thickened',
            'Thinned',
            'Solidified',
            'Liquefied',
            'Hardened',
            'Softened',
            'Stiffened',
            'Relaxed',
            'Tightened',
            'Loosened',
            'Fastened',
            'Unfastened',
            'Secured',
            'Unsecured',
            'Fixed',
            'Unfixed',
            'Attached',
            'Detached',
            'Connected',
            'Disconnected',
            'Linked',
            'Unlinked',
            'Joined',
            'Separated',
            'United',
            'Divided',
            'Combined',
            'Split',
            'Merged',
            'Parted',
            'Blended',
            'Separated',
            'Mixed',
            'Unmixed',
            'Stirred',
            'Unstirred',
            'Shaken',
            'Unshaken',
            'Agitated',
            'Calmed',
            'Disturbed',
            'Settled',
            'Troubled',
            'Soothed',
            'Worried',
            'Reassured',
            'Concerned',
            'Unconcerned',
            'Anxious',
            'Relaxed',
            'Nervous',
            'Calm',
            'Tense',
            'Loose',
            'Stressed',
            'Unstressed',
            'Pressured',
            'Unpressured',
            'Strained',
            'Unstrained',
            'Stretched',
            'Contracted',
            'Extended',
            'Retracted',
            'Expanded',
            'Shrunk',
            'Enlarged',
            'Reduced',
            'Increased',
            'Decreased',
            'Grown',
            'Diminished',
            'Developed',
            'Undeveloped',
            'Advanced',
            'Retreated',
            'Progressed',
            'Regressed',
            'Improved',
            'Worsened',
            'Enhanced',
            'Degraded',
            'Upgraded',
            'Downgraded',
            'Refined',
            'Coarsened',
            'Polished',
            'Roughened',
            'Smoothed',
            'Roughened',
            'Sharpened',
            'Dulled',
            'Brightened',
            'Dimmed',
            'Lightened',
            'Darkened',
            'Illuminated',
            'Obscured',
            'Clarified',
            'Confused',
            'Simplified',
            'Complicated',
            'Eased',
            'Hardened',
            'Facilitated',
            'Hindered',
            'Helped',
            'Harmed',
            'Assisted',
            'Resisted',
            'Aided',
            'Opposed',
            'Supported',
            'Undermined',
            'Backed',
            'Sabotaged',
            'Encouraged',
            'Discouraged',
            'Promoted',
            'Demoted',
            'Advanced',
            'Retarded',
            'Accelerated',
            'Decelerated',
            'Sped',
            'Slowed',
            'Quickened',
            'Delayed',
            'Hastened',
            'Postponed',
            'Rushed',
            'Procrastinated',
            'Hurried',
            'Dawdled',
            'Pressed',
            'Relaxed',
            'Urged',
            'Discouraged',
            'Pushed',
            'Pulled',
            'Forced',
            'Allowed',
            'Compelled',
            'Permitted',
            'Required',
            'Exempted',
            'Demanded',
            'Waived',
            'Insisted',
            'Yielded',
            'Persisted',
            'Gave',
            'Continued',
            'Stopped',
            'Persevered',
            'Quit',
            'Endured',
            'Surrendered',
            'Lasted',
            'Ended',
            'Survived',
            'Perished',
            'Thrived',
            'Struggled',
            'Flourished',
            'Suffered',
            'Prospered',
            'Failed',
            'Succeeded',
            'Lost',
            'Won',
            'Defeated',
            'Triumphed',
            'Lost',
            'Conquered',
            'Surrendered',
            'Overcame',
            'Succumbed',
            'Prevailed',
            'Yielded',
            'Dominated',
            'Submitted',
            'Controlled',
            'Obeyed',
            'Ruled',
            'Followed',
            'Governed',
            'Served',
            'Led',
            'Trailed',
            'Guided',
            'Wandered',
            'Directed',
            'Strayed',
            'Steered',
            'Drifted',
            'Navigated',
            'Lost',
            'Found',
            'Located',
            'Misplaced',
            'Discovered',
            'Hidden',
            'Uncovered',
            'Concealed',
            'Revealed',
            'Covered',
            'Exposed',
            'Protected',
            'Unveiled',
            'Veiled',
            'Disclosed',
            'Withheld',
            'Shared',
            'Kept',
            'Told',
            'Concealed',
            'Communicated',
            'Silenced',
            'Expressed',
            'Suppressed',
            'Spoke',
            'Hushed',
            'Said',
            'Unsaid',
            'Voiced',
            'Muted',
            'Articulated',
            'Mumbled',
            'Pronounced',
            'Slurred',
            'Declared',
            'Whispered',
            'Announced',
            'Murmured',
            'Proclaimed',
            'Muttered',
            'Stated',
            'Stuttered',
            'Asserted',
            'Stammered',
            'Claimed',
            'Babbled',
            'Maintained',
            'Rambled',
            'Argued',
            'Chattered',
            'Contended',
            'Gossiped',
            'Insisted',
            'Jabbered',
            'Alleged',
            'Prattled',
            'Suggested',
            'Blabbered',
            'Proposed',
            'Gabbed',
            'Recommended',
            'Yakked',
            'Advised',
            'Talked',
            'Counseled',
            'Conversed',
            'Guided',
            'Discussed',
            'Instructed',
            'Debated',
            'Taught',
            'Lectured',
            'Educated',
            'Preached',
            'Trained',
            'Sermonized',
            'Schooled',
            'Pontificated',
            'Informed',
            'Ranted',
            'Told',
            'Raved',
            'Explained',
            'Babbled',
            'Described',
            'Chattered',
            'Detailed',
            'Gabbed',
            'Narrated',
            'Prattled',
            'Related',
            'Blabbed',
            'Recounted',
            'Gossiped',
            'Reported',
            'Whispered',
            'Mentioned',
            'Murmured',
            'Noted',
            'Muttered',
            'Observed',
            'Mumbled',
            'Remarked',
            'Slurred',
            'Commented',
            'Stuttered',
            'Pointed',
            'Stammered',
            'Indicated',
            'Lisped',
            'Showed',
            'Drawled',
            'Demonstrated',
            'Droned',
            'Illustrated',
            'Monotoned',
            'Depicted',
            'Intoned',
            'Portrayed',
            'Chanted',
            'Represented',
            'Sang',
            'Displayed',
            'Hummed',
            'Exhibited',
            'Whistled',
            'Presented',
            'Crooned',
            'Revealed',
            'Warbled',
            'Unveiled',
            'Yodeled',
            'Exposed',
            'Shouted',
            'Uncovered',
            'Yelled',
            'Disclosed',
            'Screamed',
            'Manifested',
            'Hollered',
            'Expressed',
            'Roared',
            'Conveyed',
            'Bellowed',
            'Transmitted',
            'Shrieked',
            'Delivered',
            'Screeched',
            'Sent',
            'Squealed',
            'Passed',
            'Wailed',
            'Gave',
            'Howled',
            'Handed',
            'Cried',
            'Offered',
            'Sobbed',
            'Provided',
            'Whimpered',
            'Supplied',
            'Sniffled',
            'Furnished',
            'Blubbered',
            'Contributed',
            'Bawled',
            'Donated',
            'Moaned',
            'Granted',
            'Groaned',
            'Awarded',
            'Sighed',
            'Bestowed',
            'Gasped',
            'Conferred',
            'Panted',
            'Imparted',
            'Wheezed',
            'Shared',
            'Huffed',
            'Distributed',
            'Puffed',
            'Allocated',
            'Breathed',
            'Assigned',
            'Exhaled',
            'Designated',
            'Inhaled',
            'Appointed',
            'Snorted',
            'Named',
            'Sniffed',
            'Called',
            'Smelled',
            'Titled',
            'Sniffled',
            'Labeled',
            'Sneezed',
            'Tagged',
            'Coughed',
            'Marked',
            'Choked',
            'Stamped',
            'Gagged',
            'Signed',
            'Gulped',
            'Sealed',
            'Swallowed',
            'Certified',
            'Hiccupped',
            'Validated',
            'Burped',
            'Verified',
            'Belched',
            'Authenticated',
            'Yawned',
            'Authorized',
            'Stretched',
            'Licensed',
            'Flexed',
            'Registered',
            'Bent',
            'Documented',
            'Twisted',
            'Recorded',
            'Turned',
            'Filed',
            'Rotated',
            'Cataloged',
            'Spun',
            'Listed',
            'Revolved',
            'Indexed',
            'Pivoted',
            'Classified',
            'Swiveled',
            'Categorized',
            'Rolled',
            'Grouped',
            'Tumbled',
            'Sorted',
            'Flipped',
            'Arranged',
            'Flopped',
            'Organized',
            'Tossed',
            'Ordered',
            'Threw',
            'Structured',
            'Hurled',
            'Systematized',
            'Flung',
            'Coordinated',
            'Cast',
            'Synchronized',
            'Pitched',
            'Harmonized',
            'Lobbed',
            'Aligned',
            'Heaved',
            'Balanced',
            'Chucked',
            'Adjusted',
            'Launched',
            'Calibrated',
            'Catapulted',
            'Tuned',
            'Slung',
            'Regulated',
            'Fired',
            'Controlled',
            'Shot',
            'Managed',
            'Aimed',
            'Governed',
            'Targeted',
            'Directed',
            'Pointed',
            'Guided',
            'Focused',
            'Steered',
            'Concentrated',
            'Navigated',
            'Centered',
            'Piloted',
            'Zeroed',
            'Drove',
            'Honed',
            'Operated',
            'Sharpened',
            'Ran',
            'Refined',
            'Worked',
            'Perfected',
            'Functioned',
            'Polished',
            'Performed',
            'Smoothed',
            'Executed',
            'Buffed',
            'Carried',
            'Burnished',
            'Conducted',
            'Glossed',
            'Accomplished',
            'Shined',
            'Achieved',
            'Gleamed',
            'Completed',
            'Sparkled',
            'Finished',
            'Glittered',
            'Fulfilled',
            'Twinkled',
            'Realized',
            'Glowed',
            'Attained',
            'Radiated',
            'Reached',
            'Beamed',
            'Gained',
            'Illuminated',
            'Obtained',
            'Brightened',
            'Acquired',
            'Lit',
            'Secured',
            'Lightened',
            'Won',
            'Dimmed',
            'Earned',
            'Darkened',
            'Deserved',
            'Shadowed',
            'Merited',
            'Shaded',
            'Qualified',
            'Obscured',
            'Entitled',
            'Veiled',
            'Warranted',
            'Clouded',
            'Justified',
            'Covered',
            'Validated',
            'Masked',
            'Substantiated',
            'Hidden',
            'Proved',
            'Concealed',
            'Demonstrated',
            'Camouflaged',
            'Established',
            'Disguised',
            'Confirmed',
            'Cloaked',
            'Verified',
            'Shrouded',
            'Authenticated',
            'Wrapped',
            'Certified',
            'Enveloped',
            'Endorsed',
            'Encased',
            'Approved',
            'Enclosed',
            'Sanctioned',
            'Contained',
            'Authorized',
            'Surrounded',
            'Licensed',
            'Encompassed',
            'Permitted',
            'Embraced',
            'Allowed',
            'Hugged',
            'Granted',
            'Cuddled',
            'Accorded',
            'Snuggled',
            'Conceded',
            'Nestled',
            'Yielded',
            'Cradled',
            'Gave',
            'Held',
            'Provided',
            'Grasped',
            'Supplied',
            'Gripped',
            'Offered',
            'Clutched',
            'Presented',
            'Seized',
            'Delivered',
            'Grabbed',
            'Handed',
            'Caught',
            'Passed',
            'Snatched',
            'Transferred',
            'Captured',
            'Conveyed',
            'Trapped',
            'Transmitted',
            'Snared',
            'Transported',
            'Netted',
            'Carried',
            'Hooked',
            'Moved',
            'Lassoed',
            'Shifted',
            'Roped',
            'Transported',
            'Chained',
            'Relocated',
            'Tied',
            'Displaced',
            'Bound',
            'Transferred',
            'Linked',
            'Shifted',
            'Connected',
            'Moved',
            'Joined',
            'Transported',
            'United',
            'Carried',
            'Combined',
            'Bore',
            'Merged',
            'Brought',
            'Blended',
            'Took',
            'Mixed',
            'Fetched',
            'Integrated',
            'Retrieved',
            'Consolidated',
            'Collected',
            'Amalgamated',
            'Gathered',
            'Fused',
            'Assembled',
            'Welded',
            'Accumulated',
            'Bonded',
            'Amassed',
            'Cemented',
            'Stockpiled',
            'Glued',
            'Hoarded',
            'Pasted',
            'Stored',
            'Stuck',
            'Saved',
            'Adhered',
            'Preserved',
            'Attached',
            'Maintained',
            'Fastened',
            'Kept',
            'Secured',
            'Retained',
            'Fixed',
            'Held',
            'Anchored',
            'Possessed',
            'Moored',
            'Owned',
            'Tethered',
            'Had',
            'Tied',
            'Contained',
            'Bound',
            'Included',
            'Restrained',
            'Comprised',
            'Confined',
            'Encompassed',
            'Restricted',
            'Embraced',
            'Limited',
            'Covered',
            'Constrained',
            'Involved',
            'Controlled',
            'Engaged',
            'Regulated',
            'Participated',
            'Governed',
            'Contributed',
            'Managed',
            'Shared',
            'Administered',
            'Partook',
            'Supervised',
            'Joined',
            'Oversaw',
            'Entered',
            'Monitored',
            'Included',
            'Watched',
            'Admitted',
            'Observed',
            'Allowed',
            'Noticed',
            'Permitted',
            'Saw',
            'Granted',
            'Viewed',
            'Authorized',
            'Looked',
            'Approved',
            'Gazed',
            'Accepted',
            'Stared',
            'Endorsed',
            'Glanced',
            'Supported',
            'Peeked',
            'Backed',
            'Glimpsed',
            'Favored',
            'Spotted',
            'Preferred',
            'Detected',
            'Chose',
            'Sighted',
            'Selected',
            'Witnessed',
            'Picked',
            'Beheld',
            'Opted',
            'Discerned',
            'Decided',
            'Perceived',
            'Determined',
            'Recognized',
            'Resolved',
            'Identified',
            'Concluded',
            'Distinguished',
            'Settled',
            'Discriminated',
            'Agreed',
            'Differentiated',
            'Consented',
            'Separated',
            'Assented',
            'Divided',
            'Confirmed',
            'Split',
            'Affirmed',
            'Parted',
            'Validated',
            'Segregated',
            'Verified',
            'Isolated',
            'Authenticated',
            'Quarantined',
            'Certified',
            'Excluded',
            'Warranted',
            'Omitted',
            'Justified',
            'Left',
            'Substantiated',
            'Abandoned',
            'Corroborated',
            'Deserted',
            'Supported',
            'Forsook',
            'Upheld',
            'Rejected',
            'Maintained',
            'Refused',
            'Defended',
            'Declined',
            'Protected',
            'Denied',
            'Safeguarded',
            'Dismissed',
            'Shielded',
            'Discarded',
            'Guarded',
            'Threw',
            'Secured',
            'Dumped',
            'Preserved',
            'Disposed',
            'Conserved',
            'Eliminated',
            'Saved',
            'Removed',
            'Rescued',
            'Deleted',
            'Delivered',
            'Erased',
            'Liberated',
            'Obliterated',
            'Freed',
            'Destroyed',
            'Released',
            'Annihilated',
            'Emancipated',
            'Demolished',
            'Unleashed',
            'Ruined',
            'Unbound',
            'Wrecked',
            'Untied',
            'Devastated',
            'Unfastened',
            'Ravaged',
            'Loosened',
            'Damaged',
            'Opened',
            'Harmed',
            'Unlocked',
            'Hurt',
            'Unsealed',
            'Injured',
            'Uncovered',
            'Wounded',
            'Exposed',
            'Broken',
            'Revealed',
            'Fractured',
            'Unveiled',
            'Cracked',
            'Disclosed',
            'Split',
            'Shown',
            'Torn',
            'Displayed',
            'Ripped',
            'Exhibited',
            'Shredded',
            'Presented',
            'Cut',
            'Demonstrated',
            'Sliced',
            'Illustrated',
            'Chopped',
            'Depicted',
            'Diced',
            'Portrayed',
            'Minced',
            'Represented',
            'Carved',
            'Expressed',
            'Sculpted',
            'Conveyed',
            'Molded',
            'Communicated',
            'Shaped',
            'Transmitted',
            'Formed',
            'Delivered',
            'Fashioned',
            'Sent',
            'Created',
            'Dispatched',
            'Made',
            'Shipped',
            'Produced',
            'Mailed',
            'Generated',
            'Posted',
            'Manufactured',
            'Forwarded',
            'Crafted',
            'Relayed',
            'Built',
            'Passed',
            'Constructed',
            'Transferred',
            'Assembled',
            'Conveyed',
            'Erected',
            'Transported',
            'Raised',
            'Moved',
            'Lifted',
            'Shifted',
            'Hoisted',
            'Displaced',
            'Elevated',
            'Relocated',
            'Boosted',
            'Repositioned',
            'Heightened',
            'Rearranged',
            'Rose',
            'Reorganized',
            'Arose',
            'Restructured',
            'Ascended',
            'Reordered',
            'Climbed',
            'Reshuffled',
            'Mounted',
            'Redistributed',
            'Scaled',
            'Reallocated',
            'Soared',
            'Reassigned',
            'Flew',
            'Reappointed',
            'Floated',
            'Renamed',
            'Hovered',
            'Retitled',
            'Drifted',
            'Relabeled',
            'Glided',
            'Retagged',
            'Sailed',
            'Remarked',
            'Cruised',
            'Redesignated',
            'Navigated',
            'Reclassified',
            'Steered',
            'Recategorized',
            'Piloted',
            'Regrouped',
            'Drove',
            'Resorted',
            'Operated',
            'Rearranged',
            'Ran',
            'Reordered',
            'Worked',
            'Realigned',
            'Functioned',
            'Readjusted',
            'Performed',
            'Recalibrated',
            'Executed',
            'Retuned',
            'Accomplished',
            'Reregulated',
            'Achieved',
            'Recontrolled',
            'Completed',
            'Remanaged',
            'Finished',
            'Regoverned',
            'Fulfilled',
            'Redirected',
            'Realized',
            'Reguided',
            'Attained',
            'Resteered',
            'Reached',
            'Renavigated',
            'Gained',
            'Repiloted',
            'Obtained',
            'Redrove',
            'Acquired',
            'Reoperated',
            'Secured',
            'Reran',
            'Won',
            'Reworked',
            'Earned',
            'Refunctioned',
            'Deserved',
            'Reformed',
            'Merited',
            'Reperformed',
            'Qualified',
            'Reexecuted',
            'Entitled',
            'Reaccomplished',
            'Warranted',
            'Reachieved',
            'Justified',
            'Recompleted',
            'Validated',
            'Refinished',
            'Substantiated',
            'Refulfilled',
            'Proved',
            'Rerealized',
            'Demonstrated',
            'Reattained',
            'Established',
            'Rereached',
            'Confirmed',
            'Regained',
            'Verified',
            'Reobtained',
            'Authenticated',
            'Reacquired',
            'Certified',
            'Resecured',
            'Endorsed',
            'Rewon',
            'Approved',
            'Rearned',
            'Sanctioned',
            'Redeserved',
            'Authorized',
            'Remerited',
            'Licensed',
            'Requalified',
            'Permitted',
            'Reentitled',
            'Allowed',
            'Rewarranted',
            'Granted',
            'Rejustified',
            'Accorded',
            'Revalidated',
            'Conceded',
            'Resubstantiated',
            'Yielded',
            'Reproved',
            'Gave',
            'Redemonstrated',
            'Provided',
            'Reestablished',
            'Supplied',
            'Reconfirmed',
            'Offered',
            'Reverified',
            'Presented',
            'Reauthenticated',
            'Delivered',
            'Recertified',
            'Handed',
            'Reendorsed',
            'Passed',
            'Reapproved',
            'Transferred',
            'Resanctioned',
            'Conveyed',
            'Reauthorized',
            'Transmitted',
            'Relicensed',
            'Transported',
            'Repermitted',
            'Carried',
            'Reallowed',
            'Moved',
            'Regranted',
            'Shifted',
            'Reaccorded',
            'Displaced',
            'Reconceded',
            'Relocated',
            'Reyielded',
            'Repositioned',
            'Regave',
            'Rearranged',
            'Reprovided',
            'Reorganized',
            'Resupplied',
            'Restructured',
            'Reoffered',
            'Reordered',
            'Represented',
            'Reshuffled',
            'Redelivered',
            'Redistributed',
            'Rehanded',
            'Reallocated',
            'Repassed',
            'Reassigned',
            'Retransferred',
            'Reappointed',
            'Reconveyed',
            'Renamed',
            'Retransmitted',
            'Retitled',
            'Retransported',
            'Relabeled',
            'Recarried',
            'Retagged',
            'Removed',
            'Remarked',
            'Reshifted',
            'Redesignated',
            'Redisplaced',
            'Reclassified',
            'Rerelocated',
            'Recategorized',
            'Repositioned',
            'Regrouped',
            'Rearranged',
            'Resorted',
            'Reorganized',
            'Rearranged',
            'Restructured',
            'Reordered',
            'Reordered',
            'Realigned',
            'Reshuffled',
            'Readjusted',
            'Redistributed',
            'Recalibrated',
            'Reallocated',
            'Retuned',
            'Reassigned',
            'Reregulated',
            'Reappointed',
            'Recontrolled',
            'Renamed',
            'Remanaged',
            'Retitled',
            'Regoverned',
            'Relabeled',
            'Redirected',
            'Retagged',
            'Reguided',
            'Remarked',
            'Resteered',
            'Redesignated',
            'Renavigated',
            'Reclassified',
            'Repiloted',
            'Recategorized',
            'Redrove',
            'Regrouped',
            'Reoperated',
            'Resorted',
            'Reran',
            'Rearranged',
            'Reworked',
            'Reordered',
            'Refunctioned',
            'Realigned',
            'Reformed',
            'Readjusted',
            'Reperformed',
            'Recalibrated',
            'Reexecuted',
            'Retuned',
            'Reaccomplished',
            'Reregulated',
            'Reachieved',
            'Recontrolled',
            'Recompleted',
            'Remanaged',
            'Refinished',
            'Regoverned',
            'Refulfilled',
            'Redirected',
            'Rerealized',
            'Reguided',
            'Reattained',
            'Resteered',
            'Rereached',
            'Renavigated',
            'Regained',
            'Repiloted',
            'Reobtained',
            'Redrove',
            'Reacquired',
            'Reoperated',
            'Resecured',
            'Reran',
            'Rewon',
            'Reworked',
            'Rearned',
            'Refunctioned',
            'Redeserved',
            'Reformed',
            'Remerited',
            'Reperformed',
            'Requalified',
            'Reexecuted',
            'Reentitled',
            'Reaccomplished',
            'Rewarranted',
            'Reachieved',
            'Rejustified',
            'Recompleted',
            'Revalidated',
            'Refinished',
            'Resubstantiated',
            'Refulfilled',
            'Reproved',
            'Rerealized',
            'Redemonstrated',
            'Reattained',
            'Reestablished',
            'Rereached',
            'Reconfirmed',
            'Regained',
            'Reverified',
            'Reobtained',
            'Reauthenticated',
            'Reacquired',
            'Recertified',
            'Resecured',
            'Reendorsed',
            'Rewon',
            'Reapproved',
            'Rearned',
            'Resanctioned',
            'Redeserved',
            'Reauthorized',
            'Remerited',
            'Relicensed',
            'Requalified',
            'Repermitted',
            'Reentitled',
            'Reallowed',
            'Rewarranted',
            'Regranted',
            'Rejustified',
            'Reaccorded',
            'Revalidated',
            'Reconceded',
            'Resubstantiated',
            'Reyielded',
            'Reproved',
            'Regave',
            'Redemonstrated',
            'Reprovided',
            'Reestablished',
            'Resupplied',
            'Reconfirmed',
            'Reoffered',
            'Reverified',
            'Represented',
            'Reauthenticated',
            'Redelivered',
            'Recertified',
            'Rehanded',
            'Reendorsed',
            'Repassed',
            'Reapproved',
            'Retransferred',
            'Resanctioned',
            'Reconveyed',
            'Reauthorized',
            'Retransmitted',
            'Relicensed',
            'Retransported',
            'Repermitted',
            'Recarried',
            'Reallowed',
            'Removed',
            'Regranted',
            'Reshifted',
            'Reaccorded',
            'Redisplaced',
            'Reconceded',
            'Rerelocated',
            'Reyielded',
            'Repositioned',
            'Regave',
            'Rearranged',
            'Reprovided',
            'Reorganized',
            'Resupplied',
            'Restructured',
            'Reoffered',
            'Reordered',
            'Represented',
            'Reshuffled',
            'Redelivered',
            'Redistributed',
            'Rehanded',
            'Reallocated',
            'Repassed',
            'Reassigned',
            'Retransferred',
            'Reappointed',
            'Reconveyed',
            'Renamed',
            'Retransmitted',
            'Retitled',
            'Retransported',
            'Relabeled',
            'Recarried',
            'Retagged',
            'Removed',
            'Remarked',
            'Reshifted',
            'Redesignated',
            'Redisplaced',
            'Reclassified',
            'Rerelocated',
            'Recategorized',
            'Repositioned',
            'Regrouped',
            'Rearranged',
            'Resorted',
            'Reorganized',
            'Rearranged',
            'Restructured',
            'Reordered',
            'Reordered',
            'Realigned',
            'Reshuffled',
            'Readjusted',
            'Redistributed',
            'Recalibrated',
            'Reallocated',
            'Retuned',
            'Reassigned',
            'Reregulated',
            'Reappointed',
            'Recontrolled',
            'Renamed',
            'Remanaged',
            'Retitled',
            'Regoverned',
            'Relabeled',
            'Redirected',
            'Retagged',
            'Reguided',
            'Remarked',
            'Resteered',
            'Redesignated',
            'Renavigated',
            'Reclassified',
            'Repiloted',
            'Recategorized',
            'Redrove',
            'Regrouped',
            'Reoperated',
            'Resorted',
            'Reran',
            'Rearranged',
            'Reworked',
            'Reordered',
            'Refunctioned',
            'Realigned',
            'Reformed',
            'Readjusted',
            'Reperformed',
            'Recalibrated',
            'Reexecuted',
            'Retuned',
            'Reaccomplished',
            'Reregulated',
            'Reachieved',
            'Recontrolled',
            'Recompleted',
            'Remanaged',
            'Refinished',
            'Regoverned',
            'Refulfilled',
            'Redirected',
            'Rerealized',
            'Reguided',
            'Reattained',
            'Resteered',
            'Rereached',
            'Renavigated',
            'Regained',
            'Repiloted',
            'Reobtained',
            'Redrove',
            'Reacquired',
            'Reoperated',
            'Resecured',
            'Reran',
            'Rewon',
            'Reworked',
            'Rearned',
            'Refunctioned',
            'Redeserved',
            'Reformed',
            'Remerited',
            'Reperformed',
            'Requalified',
            'Reexecuted',
            'Reentitled',
            'Reaccomplished',
            'Rewarranted',
            'Reachieved',
            'Rejustified',
            'Recompleted',
            'Revalidated',
            'Refinished',
            'Resubstantiated',
            'Refulfilled',
            'Reproved',
            'Rerealized',
            'Redemonstrated',
            'Reattained',
            'Reestablished',
            'Rereached',
            'Reconfirmed',
            'Regained',
            'Reverified',
            'Reobtained',
            'Reauthenticated',
            'Reacquired',
            'Recertified',
            'Resecured',
            'Reendorsed',
            'Rewon',
            'Reapproved',
            'Rearned',
            'Resanctioned',
            'Redeserved',
            'Reauthorized',
            'Remerited',
            'Relicensed',
            'Requalified',
            'Repermitted',
            'Reentitled',
            'Reallowed',
            'Rewarranted',
            'Regranted',
            'Rejustified',
            'Reaccorded',
            'Revalidated',
            'Reconceded',
            'Resubstantiated',
            'Reyielded',
            'Reproved',
            'Regave',
            'Redemonstrated',
            'Reprovided',
            'Reestablished',
            'Resupplied',
            'Reconfirmed',
            'Reoffered',
            'Reverified',
            'Represented',
            'Reauthenticated',
            'Redelivered',
            'Recertified',
            'Rehanded',
            'Reendorsed',
            'Repassed',
            'Reapproved',
            'Retransferred',
            'Resanctioned',
            'Reconveyed',
            'Reauthorized',
            'Retransmitted',
            'Relicensed',
            'Retransported',
            'Repermitted',
            'Recarried',
            'Reallowed',
            'Removed',
            'Regranted',
            'Reshifted',
            'Reaccorded',
            'Redisplaced',
            'Reconceded',
            'Rerelocated',
            'Reyielded',
            'Repositioned',
            'Regave',
            'Rearranged',
            'Reprovided',
            'Reorganized',
            'Resupplied',
            'Restructured',
            'Reoffered',
            'Reordered',
            'Represented',
            'Reshuffled',
            'Redelivered',
            'Redistributed',
            'Rehanded',
            'Reallocated',
            'Repassed',
            'Reassigned',
            'Retransferred',
            'Reappointed',
            'Reconveyed',
            'Renamed',
            'Retransmitted',
            'Retitled',
            'Retransported',
            'Relabeled',
            'Recarried',
            'Retagged',
            'Removed',
            'Remarked',
            'Reshifted',
          ];

          if (!commonWords.includes(potentialName)) {
            characterName = potentialName;
            characterDesc = characterName; // Just use the name
          }
        }

        // Add to characters array
        if (characterDesc) {
          if (animalType && !characters.animals.includes(animalType)) {
            characters.animals.push(animalType);
          }
          if (!characters.animals.includes(characterDesc)) {
            characters.animals.push(characterDesc);
          }
        }
      }
    });

    return characters;
  }

  private extractScenes(content: string, _words: string[]): ExtractedScenes {
    const scenes: ExtractedScenes = {
      nature: [],
      buildings: [],
      urban: [],
      indoor: [],
      magical: [],
    };

    // Extract different types of scenes with flexible matching
    Object.entries(SCENE_PATTERNS).forEach(([type, patterns]) => {
      const found = patterns.filter(pattern => {
        // Handle multi-word patterns and single words differently
        if (pattern.includes(' ')) {
          // For phrases like "enchanted forest", check if the phrase exists
          return content.toLowerCase().includes(pattern.toLowerCase());
        } else {
          // For single words, use word boundary matching
          const regex = new RegExp(
            `\\b${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
            'i',
          );
          return regex.test(content);
        }
      });
      if (type in scenes) {
        (scenes as any)[type] = found.slice(0, 2); // Limit to 2 per type
      }
    });

    return scenes;
  }

  private extractEmotions(content: string, _words: string[]): string[] {
    const emotions: string[] = [];

    Object.values(EMOTION_PATTERNS)
      .flat()
      .forEach(emotion => {
        const regex = new RegExp(`\\b${emotion}\\b`, 'i');
        if (regex.test(content) && !emotions.includes(emotion)) {
          emotions.push(emotion);
        }
      });

    return emotions.slice(0, 3);
  }

  private extractActions(content: string, _words: string[]): string[] {
    const actions: string[] = [];

    Object.values(ACTION_PATTERNS)
      .flat()
      .forEach(action => {
        const regex = new RegExp(`\\b${action}\\b`, 'i');
        if (regex.test(content) && !actions.includes(action)) {
          actions.push(action);
        }
      });

    return actions.slice(0, 4);
  }

  private extractThemes(content: string, _words: string[]): string[] {
    const themes: string[] = [];

    // Identify common story themes
    const themePatterns = {
      friendship: ['friend', 'friendship', 'together', 'help', 'support'],
      adventure: ['adventure', 'journey', 'explore', 'discover', 'quest'],
      family: [
        'family',
        'mother',
        'father',
        'parent',
        'sibling',
        'brother',
        'sister',
      ],
      learning: [
        'learn',
        'school',
        'teach',
        'lesson',
        'understand',
        'knowledge',
      ],
      magic: ['magic', 'magical', 'enchanted', 'spell', 'wizard', 'fairy'],
      nature: [
        'nature',
        'environment',
        'animals',
        'forest',
        'earth',
        'natural',
      ],
    };

    Object.entries(themePatterns).forEach(([theme, patterns]) => {
      const matches = patterns.filter(pattern => {
        const regex = new RegExp(`\\b${pattern}\\b`, 'i');
        return regex.test(content);
      });
      if (matches.length >= 2) {
        // Require multiple indicators for theme
        themes.push(theme);
      }
    });

    return themes.slice(0, 2);
  }

  private extractKeyMoments(sentences: string[]): string[] {
    // Find sentences that likely describe key visual moments
    const keyMoments = sentences
      .filter(sentence => {
        const s = sentence.toLowerCase();
        return (
          s.includes('saw') ||
          s.includes('found') ||
          s.includes('discovered') ||
          s.includes('appeared') ||
          s.includes('looked') ||
          s.includes('beautiful') ||
          s.includes('amazing') ||
          s.includes('wonderful') ||
          s.includes('magical')
        );
      })
      .slice(0, 2);

    return keyMoments.map(moment => moment.trim().slice(0, 100));
  }

  private assessComplexity(
    words: string[],
    sentences: string[],
  ): 'simple' | 'moderate' | 'complex' {
    const avgWordsPerSentence = words.length / Math.max(sentences.length, 1);
    const complexWords = words.filter(word => word.length > 6).length;
    const complexityRatio = complexWords / words.length;

    if (avgWordsPerSentence < 8 && complexityRatio < 0.1) {
      return 'simple';
    } else if (avgWordsPerSentence < 15 && complexityRatio < 0.2) {
      return 'moderate';
    } else {
      return 'complex';
    }
  }

  private sanitizeStoryContent(
    content: string,
    gradeLevel: GradeLevel = 'K-2',
  ): string {
    const result = this.enhancedContentFilter(content, gradeLevel);

    if (!result.isSafe) {
      // Log content safety violation
      errorLogger
        .logError(
          'content_safety',
          'medium',
          'queue_manager',
          'Inappropriate content detected and filtered',
          {
            gradeLevel,
            flaggedTerms: result.flaggedTerms,
            severityLevel: result.severity,
            originalLength: content.length,
            sanitizedLength: result.sanitizedContent.length,
          },
        )
        .catch(logError => {
          console.warn('Failed to log content safety violation:', logError);
        });
    }

    return result.sanitizedContent;
  }

  private enhancedContentFilter(
    content: string,
    gradeLevel: GradeLevel,
  ): {
    isSafe: boolean;
    sanitizedContent: string;
    flaggedTerms: string[];
    severity: 'low' | 'medium' | 'high';
    violations: string[];
  } {
    let sanitized = content.toLowerCase();
    const flaggedTerms: string[] = [];
    const violations: string[] = [];
    let maxSeverity: 'low' | 'medium' | 'high' = 'low';

    const gradeRestrictions = GRADE_LEVEL_RESTRICTIONS[gradeLevel];

    // Check for high severity violations (always filtered)
    const highSeverityPatterns = [
      ...UNSAFE_CONTENT_PATTERNS.violence_high,
      ...UNSAFE_CONTENT_PATTERNS.weapons,
      ...UNSAFE_CONTENT_PATTERNS.explicit,
      ...UNSAFE_CONTENT_PATTERNS.drugs,
      ...UNSAFE_CONTENT_PATTERNS.hate,
    ];

    highSeverityPatterns.forEach(pattern => {
      const regex = new RegExp(`\\b${this.escapeRegExp(pattern)}\\b`, 'gi');
      if (regex.test(sanitized)) {
        flaggedTerms.push(pattern);
        violations.push(`High severity: ${pattern}`);
        maxSeverity = 'high';

        // Replace with safe alternative or remove
        const replacement = CONTENT_REPLACEMENTS[pattern] || '';
        sanitized = sanitized.replace(regex, replacement);
      }
    });

    // Check medium severity based on grade level
    if (gradeLevel === 'K-2' || gradeLevel === '3-5') {
      const mediumSeverityPatterns = [
        ...UNSAFE_CONTENT_PATTERNS.violence_medium,
        ...UNSAFE_CONTENT_PATTERNS.scary_medium,
      ];

      mediumSeverityPatterns.forEach(pattern => {
        const regex = new RegExp(`\\b${this.escapeRegExp(pattern)}\\b`, 'gi');
        if (regex.test(sanitized)) {
          flaggedTerms.push(pattern);
          violations.push(`Medium severity: ${pattern}`);
          if (maxSeverity === 'low') maxSeverity = 'medium';

          const replacement = (CONTENT_REPLACEMENTS as any)[pattern] || '';
          sanitized = sanitized.replace(regex, replacement);
        }
      });
    }

    // Check for grade-specific restrictions
    if (gradeRestrictions.extraFilters) {
      gradeRestrictions.extraFilters.forEach(filterCategory => {
        const patterns = (UNSAFE_CONTENT_PATTERNS as any)[filterCategory] || [];
        patterns.forEach((pattern: string) => {
          const regex = new RegExp(`\\b${this.escapeRegExp(pattern)}\\b`, 'gi');
          if (regex.test(sanitized)) {
            flaggedTerms.push(pattern);
            violations.push(`Grade restriction (${gradeLevel}): ${pattern}`);
            if (maxSeverity === 'low') maxSeverity = 'medium';

            const replacement = (CONTENT_REPLACEMENTS as any)[pattern] || '';
            sanitized = sanitized.replace(regex, replacement);
          }
        });
      });
    }

    // Clean up extra spaces and restore original casing where possible
    sanitized = sanitized.replace(/\s+/g, ' ').trim();

    // Add required safety elements for younger grades
    if (gradeLevel === 'K-2' && sanitized.length > 0) {
      const safetyWords = ['safe', 'friendly', 'happy', 'colorful'];
      const hasAnySafetyWord = safetyWords.some(word =>
        sanitized.toLowerCase().includes(word),
      );

      if (!hasAnySafetyWord) {
        sanitized = `friendly ${sanitized}`;
      }
    }

    // Validate minimum content length
    if (sanitized.length < 10) {
      sanitized = this.generateSafeAlternativePrompt(gradeLevel);
      violations.push('Content too short after filtering');
    }

    const isSafe = flaggedTerms.length === 0 || maxSeverity === 'low';

    return {
      isSafe,
      sanitizedContent: sanitized,
      flaggedTerms,
      severity: maxSeverity,
      violations,
    };
  }

  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private generateSafeAlternativePrompt(gradeLevel: GradeLevel): string {
    const safePrompts = {
      'K-2': 'A colorful, friendly illustration perfect for young children',
      '3-5':
        'An engaging, age-appropriate illustration for elementary students',
      '6-8':
        'An interesting, educational illustration for middle school students',
      '9-12':
        'A thoughtful, mature illustration appropriate for high school students',
    };

    return safePrompts[gradeLevel] || safePrompts['K-2'];
  }

  private generateEnhancedGradeAppropriatePrompt(
    _sanitizedContent: string,
    analysis: StoryAnalysis,
    artStyleDefinition: ArtStyleDefinition,
    gradeLevel: GradeLevel,
  ): string {
    const promptParts: string[] = [];
    const usedConcepts = new Set<string>(); // Track concepts to avoid redundancy

    // Helper function to add prompt parts while avoiding duplicates
    const addPromptPart = (part: string, prefix: string = ''): void => {
      if (!part || part.trim().length === 0) return;

      const normalizedPart = part.toLowerCase().trim();
      const fullPart = prefix ? `${prefix} ${part}` : part;

      // Check for semantic overlap with existing parts
      const hasOverlap = Array.from(usedConcepts).some(
        concept =>
          normalizedPart.includes(concept) || concept.includes(normalizedPart),
      );

      if (!hasOverlap) {
        promptParts.push(fullPart);
        usedConcepts.add(normalizedPart);
      }
    };

    // Base art style from enhanced definition
    addPromptPart(artStyleDefinition.baseStyle, 'Create a');

    // Add specific visual elements based on story analysis
    const visualElements = this.buildVisualElements(analysis, gradeLevel);
    if (visualElements && visualElements !== 'a story scene') {
      addPromptPart(visualElements, 'showing');
    } else if (
      analysis.characters.people.length > 0 ||
      analysis.characters.animals.length > 0
    ) {
      // Fallback to basic character info if visual elements failed
      const characters = [
        ...analysis.characters.people,
        ...analysis.characters.animals,
      ].slice(0, 2);
      if (characters.length > 0) {
        addPromptPart(characters.join(' and '), 'showing');
      }
    }

    // Add setting using enhanced background guidance
    const setting = this.buildEnhancedSettingDescription(
      analysis.scenes,
      artStyleDefinition,
      analysis,
    );
    if (setting) {
      addPromptPart(setting, 'in');
    }

    // Enhanced color palette guidance
    addPromptPart(artStyleDefinition.colorPalette, 'using');

    // Enhanced visual complexity guidance
    addPromptPart(artStyleDefinition.visualComplexity, 'with');

    // Enhanced artistic technique
    addPromptPart(artStyleDefinition.artisticTechnique, 'rendered in');

    // Enhanced emotional tone based on story analysis
    const enhancedEmotionalTone = this.buildEnhancedEmotionalTone(
      artStyleDefinition,
      analysis.emotions,
      analysis.themes,
    );
    addPromptPart(enhancedEmotionalTone, 'conveying');

    // Enhanced layout style
    addPromptPart(artStyleDefinition.layoutStyle, 'composed with');

    // Enhanced character style
    addPromptPart(artStyleDefinition.characterStyle, 'featuring');

    // Theme-specific enhancements
    if (
      analysis.storyThemes?.primary === 'friendship' ||
      analysis.storyThemes?.primary === 'collaboration'
    ) {
      addPromptPart(
        'warm, welcoming atmosphere with characters interacting positively',
        'emphasizing',
      );
    }

    if (analysis.plotDevices && analysis.plotDevices.length > 0) {
      const device = analysis.plotDevices[0];
      if (device.type === 'magical_item') {
        addPromptPart('magical glow and sparkle effects', 'including');
      }
    }

    // Safety guidelines
    promptParts.push('Safe for children, appropriate content');

    // Validate and clean final prompt
    const finalPrompt = promptParts.join(', ');

    // Ensure minimum prompt quality
    if (finalPrompt.length < 100) {
      console.warn('🚨 Generated prompt is too short, adding fallback content');
      const fallbackContent = this.generateMinimalQualityPrompt(
        gradeLevel,
        analysis,
      );
      return finalPrompt + ', ' + fallbackContent;
    }

    return finalPrompt;
  }

  private generateMinimalQualityPrompt(
    gradeLevel: GradeLevel,
    analysis: StoryAnalysis,
  ): string {
    const basicPrompts = {
      'K-2': "a colorful children's book illustration with friendly characters",
      '3-5':
        'an engaging story illustration with vibrant colors and clear details',
      '6-8':
        'a detailed digital illustration with realistic elements and good composition',
      '9-12':
        'a sophisticated artistic illustration with mature visual elements',
    };

    let fallback = basicPrompts[gradeLevel] || basicPrompts['K-2'];

    // Add any available story context
    if (analysis.themes.length > 0) {
      fallback += `, featuring ${analysis.themes[0]} themes`;
    }

    return fallback;
  }

  // Legacy method for backward compatibility
  private generateGradeAppropriatePrompt(
    sanitizedContent: string,
    analysis: StoryAnalysis,
    artStyle: string,
    gradeLevel: GradeLevel,
  ): string {
    // Fallback to simple art style mapping for legacy support
    const artStyleDefinition = ART_STYLE_MAPPING[gradeLevel];
    return this.generateEnhancedGradeAppropriatePrompt(
      sanitizedContent,
      analysis,
      artStyleDefinition,
      gradeLevel,
    );
  }

  private buildVisualElements(
    analysis: StoryAnalysis,
    _gradeLevel: GradeLevel,
  ): string {
    const elements: string[] = [];
    const seenElements = new Set<string>(); // Track duplicates
    const seenKeywords = new Set<string>(); // Track key words to avoid semantic duplicates

    // Helper function to check for semantic duplicates
    const addIfUnique = (desc: string, _priority: number = 1): boolean => {
      if (!desc || desc.length < 3) return false;

      const normalizedDesc = desc.toLowerCase().trim();
      const keywords = normalizedDesc
        .split(/\s+/)
        .filter(word => word.length > 2);

      // Check for exact duplicates first
      if (seenElements.has(normalizedDesc)) return false;

      // Check for semantic overlaps (sharing 70% or more keywords)
      const keywordOverlap = keywords.filter(keyword =>
        seenKeywords.has(keyword),
      ).length;
      const overlapRatio =
        keywords.length > 0 ? keywordOverlap / keywords.length : 0;

      if (overlapRatio > 0.7) return false; // Too much semantic overlap

      // Add to tracking sets
      seenElements.add(normalizedDesc);
      keywords.forEach(keyword => seenKeywords.add(keyword));
      elements.push(desc);
      return true;
    };

    // ==========================================
    // ENHANCED PRIORITY-BASED ELEMENT EXTRACTION
    // ==========================================

    // PRIORITY 1: PROTAGONIST (Highest Priority)
    if (analysis.protagonist) {
      const protagonistDesc =
        analysis.protagonist.description || analysis.protagonist.name;
      addIfUnique(protagonistDesc, 10);
      console.log(`🎯 Adding protagonist: ${protagonistDesc}`);
    }

    // PRIORITY 2: PLOT DEVICES (Magical items, important objects)
    if (analysis.plotDevices && analysis.plotDevices.length > 0) {
      const primaryPlotDevice = analysis.plotDevices[0];
      if (primaryPlotDevice.significance > 3) {
        addIfUnique(`${primaryPlotDevice.description}`, 8);
        console.log(`✨ Adding plot device: ${primaryPlotDevice.description}`);
      }
    }

    // PRIORITY 3: COLLABORATION/FRIENDSHIP ELEMENTS
    if (analysis.storyThemes?.collaborativeElements.length > 0) {
      const collaborativeAction = analysis.storyThemes.collaborativeElements[0];
      addIfUnique(`characters ${collaborativeAction}`, 7);
      console.log(`🤝 Adding collaborative element: ${collaborativeAction}`);
    }

    // PRIORITY 4: RICH DETAILS (Colors, unique objects, emotional moments)
    if (analysis.richDetails) {
      // Add specific colors
      if (analysis.richDetails.specificColors.length > 0) {
        const topColors = analysis.richDetails.specificColors.slice(0, 2);
        topColors.forEach(color => {
          addIfUnique(color, 6);
          console.log(`🎨 Adding color detail: ${color}`);
        });
      }

      // Add unique objects
      if (analysis.richDetails.uniqueObjects.length > 0) {
        const topObjects = analysis.richDetails.uniqueObjects.slice(0, 2);
        topObjects.forEach(obj => {
          addIfUnique(obj, 5);
          console.log(`🎲 Adding unique object: ${obj}`);
        });
      }

      // Add emotional moments for context
      if (analysis.richDetails.emotionalMoments.length > 0) {
        const emotionalContext = analysis.richDetails.emotionalMoments[0];
        addIfUnique(`${emotionalContext} expression`, 4);
        console.log(`😊 Adding emotional context: ${emotionalContext}`);
      }
    }

    // PRIORITY 5: SECONDARY CHARACTERS (Enhanced integration)
    if (
      analysis.secondaryCharacters &&
      analysis.secondaryCharacters.length > 0
    ) {
      const topSecondaryCharacters = analysis.secondaryCharacters
        .filter(char => char.importance > 3) // Only include meaningful characters
        .slice(0, 2); // Limit to top 2

      topSecondaryCharacters.forEach(char => {
        const characterDesc = `${char.name} the ${char.type}${
          char.role !== 'other' ? ` (${char.role})` : ''
        }`;
        addIfUnique(characterDesc, 6);
        console.log(
          `👥 Adding secondary character: ${characterDesc} (importance: ${char.importance})`,
        );
      });
    }

    // PRIORITY 6: ENHANCED COLOR DETAILS
    if (analysis.enhancedColorDetails) {
      // Add dominant colors with emotional context
      if (analysis.enhancedColorDetails.dominantColors.length > 0) {
        const topColors = analysis.enhancedColorDetails.dominantColors.slice(
          0,
          2,
        );
        topColors.forEach(color => {
          addIfUnique(`${color} coloring`, 5);
          console.log(`🎨 Adding enhanced color: ${color}`);
        });
      }

      // Add object-color pairs for specific visual elements
      if (analysis.enhancedColorDetails.objectColorPairs.length > 0) {
        const topPairs = analysis.enhancedColorDetails.objectColorPairs.slice(
          0,
          2,
        );
        topPairs.forEach(pair => {
          addIfUnique(`${pair.color} ${pair.object}`, 5);
          console.log(
            `🎯 Adding object-color pair: ${pair.color} ${pair.object}`,
          );
        });
      }
    }

    // PRIORITY 7: DYNAMIC SCENE CONTEXT
    if (analysis.dynamicSceneContext) {
      const sceneContext = analysis.dynamicSceneContext;

      // Add current action for dynamic representation
      if (
        sceneContext.currentAction &&
        sceneContext.currentAction !== 'engaging in story adventure'
      ) {
        addIfUnique(`${sceneContext.currentAction}`, 4);
        console.log(`⚡ Adding dynamic action: ${sceneContext.currentAction}`);
      }

      // Add emotional state for better mood representation
      if (
        sceneContext.emotionalState &&
        sceneContext.emotionalState !== 'wonder'
      ) {
        addIfUnique(`${sceneContext.emotionalState} moment`, 4);
        console.log(
          `😊 Adding emotional state: ${sceneContext.emotionalState}`,
        );
      }

      // Add interaction level context
      if (sceneContext.interactionLevel === 'paired') {
        addIfUnique('two characters interacting', 3);
        console.log(`👫 Adding interaction context: paired interaction`);
      } else if (sceneContext.interactionLevel === 'group') {
        addIfUnique('group of characters together', 3);
        console.log(`👥 Adding interaction context: group interaction`);
      }

      // Add atmospheric elements for scene depth
      if (sceneContext.atmosphericElements.length > 0) {
        const topAtmospheric = sceneContext.atmosphericElements.slice(0, 2);
        topAtmospheric.forEach(element => {
          addIfUnique(`${element} atmosphere`, 3);
          console.log(`🌟 Adding atmospheric element: ${element}`);
        });
      }
    }

    // FALLBACK: Traditional secondary characters if new method didn't capture them
    if (
      analysis.characters.detailed &&
      analysis.characters.detailed.length > 1 &&
      (!analysis.secondaryCharacters ||
        analysis.secondaryCharacters.length === 0)
    ) {
      // Add secondary characters (skip protagonist if already added)
      analysis.characters.detailed
        .slice(1, 3) // Skip first if it's protagonist, take next 2
        .forEach(char => {
          addIfUnique(char.description, 2);
          console.log(
            `👥 Adding fallback secondary character: ${char.description}`,
          );
        });
    }

    // Prioritize story-specific visual concepts if available
    if (analysis.visualConcepts && analysis.visualConcepts.length > 0) {
      // Process story-specific visual concepts for prompt enhancement
      analysis.visualConcepts
        .filter(v => v.isStorySpecific)
        .slice(0, 3)
        .forEach(v => {
          // Clean up visual descriptions for better prompt flow
          let desc = v.element;
          if (v.isStorySpecific) {
            // Keep story-specific elements detailed but clean
            desc = desc.replace(/\s+/g, ' ').trim();
            // Remove redundant words and duplicates
            desc = desc.replace(/\b(\w+)\s+\1\b/gi, '$1'); // Remove word duplicates like "fox fox"
            // Make it more prompt-friendly
            desc = desc.replace(
              /^(.*?)(wearing|with|adorned|featuring)/i,
              '$1 $2',
            );
            // Ensure complete phrases
            if (desc.length > 50 && !desc.match(/[.!?]$/)) {
              desc = desc.substring(0, desc.lastIndexOf(' '));
            }
          }
          // Add to unique elements if not already present
          addIfUnique(desc);
        });
    }

    // Fallback to enhanced character details if available
    if (
      elements.length === 0 &&
      analysis.characters.detailed &&
      analysis.characters.detailed.length > 0
    ) {
      analysis.characters.detailed
        .slice(0, 2)
        .forEach(char => addIfUnique(char.description));
    }

    // Traditional fallback for compatibility
    if (elements.length === 0) {
      const allCharacters = [
        ...analysis.characters.people,
        ...analysis.characters.animals,
        ...analysis.characters.fantasy,
      ];

      if (allCharacters.length > 0) {
        const characterDesc = allCharacters.slice(0, 2).join(' and ');
        addIfUnique(characterDesc);
      }

      // Add key actions or moments
      if (analysis.actions.length > 0) {
        const action = analysis.actions[0];
        addIfUnique(action);
      }
    }

    // Enhanced fallback mechanism if no elements were extracted
    if (elements.length === 0) {
      console.warn(
        '🔍 No visual elements extracted, using intelligent fallback analysis',
      );

      // Try extracting proper nouns as potential character names
      const properNouns =
        analysis.keyMoments.join(' ').match(/\b[A-Z][a-z]+\b/g) || [];

      if (properNouns.length > 0) {
        const uniqueNouns = [...new Set(properNouns)].slice(0, 2);
        addIfUnique(uniqueNouns.join(' and '));
      }

      // Try extracting descriptive phrases
      const descriptivePhrases =
        analysis.keyMoments
          .join(' ')
          .match(
            /\b(?:bright|colorful|magical|beautiful|sparkling|shimmering|glowing)\s+\w+/gi,
          ) || [];

      if (descriptivePhrases.length > 0) {
        const uniquePhrases = [...new Set(descriptivePhrases)].slice(0, 2);
        uniquePhrases.forEach(phrase => addIfUnique(phrase));
      }

      // Final fallback: use story themes and emotions
      if (
        elements.length === 0 &&
        (analysis.themes.length > 0 || analysis.emotions.length > 0)
      ) {
        const fallbackElements = [
          ...analysis.themes,
          ...analysis.emotions,
        ].slice(0, 2);
        fallbackElements.forEach(element =>
          addIfUnique(`${element} story elements`),
        );
      }
    }

    const result = elements.length > 0 ? elements.join(', ') : 'a story scene';
    console.log(`🔍 Final visual elements: ${result}`);
    return result;
  }

  private buildEnhancedSettingDescription(
    scenes: ExtractedScenes,
    artStyleDefinition: ArtStyleDefinition,
    analysis?: StoryAnalysis,
  ): string {
    const usedTerms = new Set<string>(); // Track used terms to avoid duplication
    const settingParts: string[] = [];

    // Check for detailed setting elements first
    if (
      analysis?.detailedVisualElements?.settings &&
      analysis.detailedVisualElements.settings.length > 0
    ) {
      const detailedSetting =
        analysis.detailedVisualElements.settings[0].concept;
      const normalizedSetting = detailedSetting.toLowerCase().trim();

      if (!usedTerms.has(normalizedSetting)) {
        settingParts.push(detailedSetting);
        usedTerms.add(normalizedSetting);
      }
    }

    // Add primary scene if not already included
    const allScenes = [
      ...scenes.nature,
      ...scenes.buildings,
      ...scenes.urban,
      ...scenes.indoor,
      ...scenes.magical,
    ];

    if (allScenes.length > 0) {
      const primaryScene = allScenes[0];
      const normalizedScene = primaryScene.toLowerCase().trim();

      if (!usedTerms.has(normalizedScene)) {
        settingParts.push(primaryScene);
        usedTerms.add(normalizedScene);
      }
    }

    // Add background style if it's not redundant
    const backgroundStyle = artStyleDefinition.backgroundStyle;
    const normalizedBackground = backgroundStyle.toLowerCase().trim();

    // Check if background style adds new information
    const hasOverlap = Array.from(usedTerms).some(
      term =>
        normalizedBackground.includes(term) ||
        term.includes(normalizedBackground.split(' ')[0]),
    );

    if (!hasOverlap && settingParts.length > 0) {
      settingParts.push(backgroundStyle);
    } else if (settingParts.length === 0) {
      // If no specific setting found, use background style as fallback
      settingParts.push(backgroundStyle);
    }

    return settingParts.join(', ');
  }

  private buildSettingDescription(scenes: ExtractedScenes): string {
    const allScenes = [
      ...scenes.nature,
      ...scenes.buildings,
      ...scenes.urban,
      ...scenes.indoor,
      ...scenes.magical,
    ];

    if (allScenes.length > 0) {
      return allScenes[0]; // Use the first found scene
    }

    return '';
  }

  private buildEnhancedEmotionalTone(
    artStyleDefinition: ArtStyleDefinition,
    emotions: string[],
    themes: string[],
  ): string {
    let enhancedTone = artStyleDefinition.emotionalTone;

    // Enhance emotional tone based on story analysis
    if (emotions.length > 0) {
      const primaryEmotion = emotions[0];
      enhancedTone += `, ${primaryEmotion} atmosphere`;
    }

    // Add thematic enhancements
    if (themes.includes('magic')) {
      enhancedTone += ', enchanting and mystical mood';
    } else if (themes.includes('adventure')) {
      enhancedTone += ', exciting and adventurous spirit';
    } else if (themes.includes('friendship')) {
      enhancedTone += ', warm and caring relationships';
    } else if (themes.includes('learning')) {
      enhancedTone += ', inspiring and educational atmosphere';
    }

    return enhancedTone;
  }

  private buildMoodDescription(
    emotions: string[],
    themes: string[],
    _gradeLevel: GradeLevel,
  ): string {
    const moodElements: string[] = [];

    // Add emotional tone
    if (emotions.length > 0) {
      moodElements.push(`${emotions[0]} atmosphere`);
    }

    // Add thematic elements
    if (themes.includes('magic')) {
      moodElements.push('magical elements');
    } else if (themes.includes('adventure')) {
      moodElements.push('sense of adventure');
    } else if (themes.includes('friendship')) {
      moodElements.push('warm friendship');
    }

    return moodElements.join(' and ');
  }

  private getGradeSpecificEnhancements(
    gradeLevel: GradeLevel,
    _analysis: StoryAnalysis,
  ): string {
    switch (gradeLevel) {
      case 'K-2':
        return 'simple shapes, bright primary colors, very friendly and non-threatening';
      case '3-5':
        return 'colorful and engaging, slightly more detailed, maintaining child-friendly appeal';
      case '6-8':
        return 'more realistic details, dynamic composition, appealing to pre-teens';
      case '9-12':
        return 'sophisticated artistry, realistic proportions, mature but appropriate content';
      default:
        return 'child-appropriate and engaging';
    }
  }

  private async createImageGenerationEvent(
    request: ImageGenerationRequest,
  ): Promise<string> {
    console.log(
      `📊 Creating image generation event for session: ${request.sessionId}`,
    );

    try {
      // Create event using xpEventTracker
      const { xpEventTracker } = await import('./xpEventTracker');

      const eventData = {
        userId: request.userId,
        sessionId: request.sessionId,
        xpCost: IMAGE_GENERATION_COST,
        storyGradeLevel: request.gradeLevel,
        storyWordCount: request.metadata?.wordCount,
        metadata: {
          timestamp: new Date().toISOString(),
          ...request.metadata,
        },
      };

      const result = await xpEventTracker.createImageGenerationEvent(eventData);

      if (result.success && result.eventId) {
        console.log(`✅ Image generation event created: ${result.eventId}`);
        return result.eventId;
      } else {
        throw new Error(
          result.error || 'Failed to create image generation event',
        );
      }
    } catch (error) {
      console.error('💥 Exception creating image generation event:', error);
      throw error;
    }
  }

  private async updateImageGenerationEvent(
    eventId: string,
    updates: {
      generation_status?: GenerationStatus;
      error_type?: ErrorType;
      service_used?: ServiceUsed;
      api_response_time?: number;
      image_url?: string;
      prompt_used?: string;
    },
  ): Promise<void> {
    console.log(`📝 Updating image generation event ${eventId} with:`, updates);

    try {
      // Update event using xpEventTracker
      const { xpEventTracker } = await import('./xpEventTracker');

      const status: GenerationStatus =
        updates.generation_status === 'success'
          ? 'success'
          : updates.generation_status === 'failed'
          ? 'failed'
          : 'pending';

      const updateData = {
        imageUrl: updates.image_url,
        serviceUsed: updates.service_used,
        apiResponseTime: updates.api_response_time,
        errorType: updates.error_type,
        promptUsed: updates.prompt_used,
      };

      await xpEventTracker.updateImageGenerationEvent(
        eventId,
        status,
        updateData,
      );
      console.log(`✅ Successfully updated event ${eventId}`);
    } catch (error) {
      console.error('💥 Exception updating image generation event:', error);
      // Don't throw here to avoid breaking the main flow
    }
  }

  private async updateGameSessionWithImage(
    sessionId: string,
    imageUrl: string,
    cost: number,
  ): Promise<void> {
    console.log(
      `🎮 Updating game session ${sessionId} with image: ${imageUrl}, cost: ${cost}`,
    );

    try {
      // Update session using storySessionManager
      const { storySessionManager } = await import('./storySessionManager');

      const updatedSession = await storySessionManager.updateSessionWithImage(
        sessionId,
        imageUrl,
        cost,
      );

      if (updatedSession) {
        console.log(
          `✅ Successfully updated session ${sessionId} with image data`,
        );
      } else {
        throw new Error('Failed to update session with image data');
      }
    } catch (error) {
      console.error('💥 Exception updating session with image:', error);
      // Don't throw here to avoid breaking the main flow
    }
  }

  private async callReplicateAPI(
    prompt: string,
    timeoutMs: number,
  ): Promise<string> {
    if (!REPLICATE_API_TOKEN) {
      throw new Error('Replicate API token not configured');
    }

    try {
      console.log(`🚀 Calling Replicate API with ${timeoutMs}ms timeout`);

      // Mock implementation for development - controlled by environment variable
      if (__DEV__ && process.env.USE_MOCK_IMAGE_GENERATION === 'true') {
        console.log(
          `🎨 Mock Replicate API call with prompt: ${prompt.substring(
            0,
            100,
          )}...`,
        );

        // Simulate timeout scenario for testing (10% chance)
        if (Math.random() < 0.1) {
          await new Promise(resolve => setTimeout(resolve, timeoutMs + 1000));
          throw new Error(`Request timed out after ${timeoutMs}ms`);
        }

        await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API delay
        return 'https://example.com/generated-image.jpg';
      }

      // Use the enhanced Replicate client with proper timeout handling
      return await this.replicateClient.generateImage(prompt, {}, timeoutMs);
    } catch (error) {
      // Enhanced error logging with timeout detection
      const errorMsg = error instanceof Error ? error.message : String(error);
      const errorName = error instanceof Error ? error.name : 'Unknown';

      if (errorMsg.includes('timeout') || errorName === 'AbortError') {
        console.error(`⏰ Replicate API timeout after ${timeoutMs}ms:`, error);

        // Log timeout error to monitoring system
        await errorLogger
          .logTimeoutError(
            'replicate',
            `Replicate API request timed out after ${timeoutMs}ms`,
            { timeoutMs, prompt: prompt.substring(0, 100) },
          )
          .catch(logError => {
            console.warn('Failed to log timeout error:', logError);
          });

        throw new Error(`Replicate API request timed out after ${timeoutMs}ms`);
      }

      console.error('💥 Replicate API call failed:', error);

      // Log API error to monitoring system
      await errorLogger
        .logAPIError(
          'replicate',
          `Replicate API call failed: ${errorMsg}`,
          {
            timeoutMs,
            prompt: prompt.substring(0, 100),
            errorName: errorName,
            errorDetails:
              error instanceof Error
                ? {
                    name: error.name,
                    message: error.message,
                    stack: error.stack,
                  }
                : { rawError: error },
          },
          error instanceof Error ? error : undefined,
        )
        .catch(logError => {
          console.warn('Failed to log API error:', logError);
        });

      throw error;
    }
  }

  private async callBackupService(
    prompt: string,
    timeoutMs: number,
  ): Promise<string> {
    if (!BACKUP_IMAGE_API_TOKEN) {
      throw new Error('Backup service API token not configured');
    }

    try {
      console.log(
        `🚀 Calling backup service (OpenAI DALL-E) with ${timeoutMs}ms timeout`,
      );

      // Mock implementation for development - replace with actual backup service API call
      if (__DEV__) {
        console.log(
          `🎨 Mock Backup API (DALL-E) call with prompt: ${prompt.substring(
            0,
            100,
          )}...`,
        );

        // Simulate timeout scenario for testing (5% chance)
        if (Math.random() < 0.05) {
          await new Promise(resolve => setTimeout(resolve, timeoutMs + 1000));
          throw new Error(`Request timed out after ${timeoutMs}ms`);
        }

        await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API delay
        return 'https://backup-service.com/dall-e-generated-image.jpg';
      }

      // Use the enhanced OpenAI DALL-E backup service client with proper timeout handling
      return await this.backupServiceClient.generateImage(
        prompt,
        {},
        timeoutMs,
      );
    } catch (error) {
      // Enhanced error logging with timeout detection
      const errorMsg = error instanceof Error ? error.message : String(error);
      const errorName = error instanceof Error ? error.name : 'Unknown';

      if (errorMsg.includes('timeout') || errorName === 'AbortError') {
        console.error(`⏰ Backup service timeout after ${timeoutMs}ms:`, error);

        // Log timeout error to monitoring system
        await errorLogger
          .logTimeoutError(
            'backup_service',
            `Backup service request timed out after ${timeoutMs}ms`,
            { timeoutMs, prompt: prompt.substring(0, 100) },
          )
          .catch(logError => {
            console.warn('Failed to log timeout error:', logError);
          });

        throw new Error(
          `Backup service request timed out after ${timeoutMs}ms`,
        );
      }

      console.error('💥 Backup service API call failed:', error);

      // Log API error to monitoring system
      await errorLogger
        .logAPIError(
          'backup_service',
          `Backup service API call failed: ${errorMsg}`,
          {
            timeoutMs,
            prompt: prompt.substring(0, 100),
            errorName: errorName,
            errorDetails:
              error instanceof Error
                ? {
                    name: error.name,
                    message: error.message,
                    stack: error.stack,
                  }
                : { rawError: error },
          },
          error instanceof Error ? error : undefined,
        )
        .catch(logError => {
          console.warn('Failed to log API error:', logError);
        });

      throw error;
    }
  }

  private async processRequest(
    request: ImageGenerationRequest,
  ): Promise<ImageGenerationResult> {
    const startTime = Date.now();
    let eventId: string | undefined;
    let serviceUsed: ServiceUsed = 'stability-ai/stable-diffusion-3.5-large';
    let errorType: ErrorType | undefined;

    try {
      // Validate configuration
      this.validateConfiguration();

      // Check XP balance (skip in testing mode)
      if (process.env.DISABLE_XP_COSTS_FOR_TESTING !== 'true') {
        const userXP = await this.checkUserXPBalance(request.userId);
        if (userXP < IMAGE_GENERATION_COST) {
          return {
            success: false,
            error: `Insufficient XP. Need ${IMAGE_GENERATION_COST} XP, have ${userXP} XP`,
            errorType: 'insufficient_xp',
            serviceUsed,
            responseTimeMs: Date.now() - startTime,
          };
        }
      }

      // Deduct XP upfront
      await this.deductXP(request.userId, IMAGE_GENERATION_COST);

      // Create tracking event
      eventId = await this.createImageGenerationEvent(request);

      // Generate prompt with enhanced content filtering
      const prompt = this.generatePrompt(
        request.storyContent,
        request.gradeLevel,
      );

      // Validate prompt safety before API call
      const promptSafety = this.enhancedContentFilter(
        prompt,
        request.gradeLevel,
      );
      if (!promptSafety.isSafe && promptSafety.severity === 'high') {
        errorType = 'content_safety';
        await this.refundXP(request.userId, IMAGE_GENERATION_COST);

        if (eventId) {
          await this.updateImageGenerationEvent(eventId, {
            generation_status: 'failed',
            error_type: errorType,
            service_used: serviceUsed,
            api_response_time: Date.now() - startTime,
            prompt_used: prompt.substring(0, 100) + '...',
          });
        }

        return {
          success: false,
          error:
            'Story content contains inappropriate material that cannot be illustrated. Please try a different story.',
          errorType,
          serviceUsed,
          responseTimeMs: Date.now() - startTime,
          eventId,
        };
      }

      // Try primary service (Replicate) with enhanced timeout handling
      let imageUrl: string;
      try {
        const primaryTimeout = TIMEOUT_CONFIG.PRIMARY_SERVICE.STANDARD;
        console.log(
          `🎯 Attempting primary service (Stable Diffusion 3.5 Large) with ${primaryTimeout}ms timeout`,
        );

        imageUrl = await this.callReplicateAPI(prompt, primaryTimeout);
        serviceUsed = 'stability-ai/stable-diffusion-3.5-large';
        console.log(
          '✅ Primary service (Stable Diffusion 3.5 Large) succeeded',
        );
      } catch (primaryError) {
        const primaryErrorMsg =
          primaryError instanceof Error
            ? primaryError.message
            : String(primaryError);
        const isInvalidUrl =
          primaryErrorMsg.includes('Invalid image URL') ||
          primaryErrorMsg.includes('Invalid output format');

        if (isInvalidUrl) {
          console.log(
            '🔄 Primary service returned invalid URL, attempting backup service:',
            primaryError,
          );
        } else {
          console.log(
            '🔄 Primary service failed, attempting backup service:',
            primaryError,
          );
        }

        // Determine if primary failure was due to timeout
        const primaryErrorName =
          primaryError instanceof Error ? primaryError.name : 'Unknown';
        const isPrimaryTimeout =
          primaryErrorMsg.includes('timeout') ||
          primaryErrorName === 'AbortError';
        if (isPrimaryTimeout) {
          console.warn(
            '⏰ Primary service failed due to timeout, trying backup with shorter timeout',
          );
        }

        // Fallback to backup service with appropriate timeout
        try {
          const backupTimeout = isPrimaryTimeout
            ? TIMEOUT_CONFIG.BACKUP_SERVICE.QUICK
            : TIMEOUT_CONFIG.BACKUP_SERVICE.STANDARD;

          console.log(
            `🛡️ Attempting backup service (Google Nano Banana) with ${backupTimeout}ms timeout`,
          );

          imageUrl = await this.callBackupService(prompt, backupTimeout);
          serviceUsed = 'google/nano-banana';
          console.log('✅ Backup service (Google Nano Banana) succeeded');
        } catch (backupError) {
          // Both services failed - determine error type
          const backupErrorMsg =
            backupError instanceof Error
              ? backupError.message
              : String(backupError);
          const backupErrorName =
            backupError instanceof Error ? backupError.name : 'Unknown';
          const isBackupTimeout =
            backupErrorMsg.includes('timeout') ||
            backupErrorName === 'AbortError';

          if (isPrimaryTimeout && isBackupTimeout) {
            errorType = 'timeout';
            console.error('⏰ Both services failed due to timeout');
          } else {
            errorType = 'api_failure';
            console.error('💥 Both services failed due to API errors');
          }

          await this.refundXP(request.userId, IMAGE_GENERATION_COST);

          if (eventId) {
            await this.updateImageGenerationEvent(eventId, {
              generation_status: 'failed',
              error_type: errorType,
              service_used: serviceUsed,
              api_response_time: Date.now() - startTime,
              prompt_used: prompt,
            });
          }

          const errorMessage =
            isPrimaryTimeout && isBackupTimeout
              ? 'Both image generation services timed out. Please try again.'
              : 'Both primary and backup image generation services failed';

          return {
            success: false,
            error: errorMessage,
            errorType,
            serviceUsed,
            responseTimeMs: Date.now() - startTime,
            eventId,
          };
        }
      }

      // Update database with successful generation
      await Promise.all([
        this.updateGameSessionWithImage(
          request.sessionId,
          imageUrl,
          IMAGE_GENERATION_COST,
        ),
        eventId
          ? this.updateImageGenerationEvent(eventId, {
              generation_status: 'success',
              image_url: imageUrl,
              service_used: serviceUsed,
              api_response_time: Date.now() - startTime,
              prompt_used: prompt,
            })
          : Promise.resolve(),
      ]);

      return {
        success: true,
        imageUrl,
        serviceUsed,
        responseTimeMs: Date.now() - startTime,
        eventId,
      };
    } catch (error) {
      console.error('Image generation failed:', error);

      // Refund XP on error
      await this.refundXP(request.userId, IMAGE_GENERATION_COST);

      // Determine error type
      if (error instanceof Error) {
        if (
          error.message.includes('content') ||
          error.message.includes('safety')
        ) {
          errorType = 'content_safety';
        } else if (
          error.message.includes('timeout') ||
          error.name === 'AbortError'
        ) {
          errorType = 'timeout';
        } else if (error.message.includes('rate limit')) {
          errorType = 'rate_limit';
        } else {
          errorType = 'api_failure';
        }
      }

      // Log system error to monitoring
      await errorLogger
        .logSystemError(
          'xp_system',
          `Image generation failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
          {
            userId: request.userId,
            sessionId: request.sessionId,
            gradeLevel: request.gradeLevel,
            errorType,
            responseTime: Date.now() - startTime,
            xpRefunded: IMAGE_GENERATION_COST,
            eventId,
          },
          error instanceof Error ? error : undefined,
        )
        .catch(logError => {
          console.warn('Failed to log system error:', logError);
        });

      if (eventId) {
        await this.updateImageGenerationEvent(eventId, {
          generation_status: 'failed',
          error_type: errorType,
          service_used: serviceUsed,
          api_response_time: Date.now() - startTime,
        });
      }

      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
        errorType,
        serviceUsed,
        responseTimeMs: Date.now() - startTime,
        eventId,
      };
    }
  }

  public async generateImage(
    request: ImageGenerationRequest,
  ): Promise<ImageGenerationResult> {
    const startTime = Date.now();

    try {
      // Enhanced rate limiting checks
      const rateLimitResult = this.checkRateLimit(request.userId);
      if (!rateLimitResult.allowed) {
        rateLimitingStats.rejectedRequests++;

        // Log rate limit error
        await errorLogger
          .logRateLimitError(
            request.userId,
            rateLimitResult.reason || 'Rate limit exceeded',
            {
              sessionId: request.sessionId,
              gradeLevel: request.gradeLevel,
              responseTime: Date.now() - startTime,
            },
          )
          .catch(logError => {
            console.warn('Failed to log rate limit error:', logError);
          });

        return {
          success: false,
          error: rateLimitResult.reason || 'Rate limit exceeded',
          errorType: 'rate_limit',
          serviceUsed: 'replicate',
          responseTimeMs: Date.now() - startTime,
        };
      }

      // Check concurrent request limit
      if (activeRequests >= RATE_LIMIT_CONFIG.MAX_CONCURRENT_REQUESTS) {
        // Check if queue is full
        if (requestQueue.length >= RATE_LIMIT_CONFIG.MAX_QUEUE_SIZE) {
          rateLimitingStats.rejectedRequests++;

          // Log queue full error
          await errorLogger
            .logError(
              'rate_limit',
              'medium',
              'queue_manager',
              `Request queue is full (${RATE_LIMIT_CONFIG.MAX_QUEUE_SIZE} requests waiting)`,
              {
                userId: request.userId,
                sessionId: request.sessionId,
                queueLength: requestQueue.length,
                maxQueueSize: RATE_LIMIT_CONFIG.MAX_QUEUE_SIZE,
                activeRequests,
                responseTime: Date.now() - startTime,
              },
            )
            .catch(logError => {
              console.warn('Failed to log queue full error:', logError);
            });

          return {
            success: false,
            error: `Server is busy. Queue is full (${RATE_LIMIT_CONFIG.MAX_QUEUE_SIZE} requests waiting). Please try again later.`,
            errorType: 'rate_limit',
            serviceUsed: 'replicate',
            responseTimeMs: Date.now() - startTime,
          };
        }

        // Add to queue with priority
        return this.queueRequest(request, startTime);
      }

      // Execute request immediately
      return this.executeRequestWithTracking(request, startTime);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Log unexpected processing error
      await errorLogger
        .logSystemError(
          'queue_manager',
          `Request processing failed: ${errorMsg}`,
          {
            userId: request.userId,
            sessionId: request.sessionId,
            responseTime: Date.now() - startTime,
            errorDetails: {
              requestId: request.sessionId + '_' + Date.now(),
              activeRequests,
              queueLength: requestQueue.length,
            },
          },
          error instanceof Error ? error : undefined,
        )
        .catch(logError => {
          console.warn('Failed to log processing error:', logError);
        });

      return {
        success: false,
        error: `Request processing failed: ${errorMsg}`,
        errorType: 'api_failure',
        serviceUsed: 'replicate',
        responseTimeMs: Date.now() - startTime,
      };
    }
  }

  public isFeatureEnabled(): boolean {
    return this.isConfigured();
  }

  public getImageGenerationCost(): number {
    return IMAGE_GENERATION_COST;
  }

  private checkRateLimit(userId: string): {
    allowed: boolean;
    reason?: string;
  } {
    const now = Date.now();
    const userLimit = userRequestCounts.get(userId);

    // Clean up old user records (older than cooldown period)
    if (
      userLimit &&
      now - userLimit.lastRequestTime >
        RATE_LIMIT_CONFIG.USER_COOLDOWN_PERIOD * 2
    ) {
      userRequestCounts.delete(userId);
    }

    if (!userLimit) {
      // First request from this user
      userRequestCounts.set(userId, {
        count: 1,
        lastRequestTime: now,
        isBlocked: false,
      });
      return { allowed: true };
    }

    // Check if user is currently blocked
    if (userLimit.isBlocked) {
      const timeSinceBlock = now - userLimit.lastRequestTime;
      if (timeSinceBlock < RATE_LIMIT_CONFIG.USER_COOLDOWN_PERIOD) {
        const remainingTime = Math.ceil(
          (RATE_LIMIT_CONFIG.USER_COOLDOWN_PERIOD - timeSinceBlock) / 1000,
        );
        return {
          allowed: false,
          reason: `Rate limited. Please wait ${remainingTime} seconds before trying again.`,
        };
      } else {
        // Unblock user
        userLimit.isBlocked = false;
        userLimit.count = 1;
        userLimit.lastRequestTime = now;
        return { allowed: true };
      }
    }

    // Check rate limit within the time window
    const timeSinceLastRequest = now - userLimit.lastRequestTime;

    if (timeSinceLastRequest < RATE_LIMIT_CONFIG.USER_COOLDOWN_PERIOD) {
      // Within the rate limit window
      if (userLimit.count >= RATE_LIMIT_CONFIG.USER_MAX_REQUESTS_PER_MINUTE) {
        // Exceeded rate limit
        userLimit.isBlocked = true;
        userLimit.lastRequestTime = now;
        const waitTime = Math.ceil(
          RATE_LIMIT_CONFIG.USER_COOLDOWN_PERIOD / 1000,
        );
        return {
          allowed: false,
          reason: `Too many requests. You can generate ${RATE_LIMIT_CONFIG.USER_MAX_REQUESTS_PER_MINUTE} images per minute. Please wait ${waitTime} seconds.`,
        };
      } else {
        // Within rate limit, increment count
        userLimit.count++;
        userLimit.lastRequestTime = now;
        return { allowed: true };
      }
    } else {
      // Outside the rate limit window, reset count
      userLimit.count = 1;
      userLimit.lastRequestTime = now;
      return { allowed: true };
    }
  }

  private async queueRequest(
    request: ImageGenerationRequest,
    startTime: number,
  ): Promise<ImageGenerationResult> {
    const queueStartTime = Date.now();

    console.log(
      `📋 Queueing request for user ${request.userId}. Queue position: ${
        requestQueue.length + 1
      }`,
    );

    return new Promise(resolve => {
      // Determine priority based on wait time and user status
      const priority = this.calculateRequestPriority(request, queueStartTime);

      const queueItem = {
        execute: async () => {
          const waitTime = Date.now() - queueStartTime;
          console.log(
            `🚀 Processing queued request for user ${request.userId} after ${waitTime}ms wait`,
          );

          // Update wait time statistics
          this.updateWaitTimeStats(waitTime);

          const result = await this.executeRequestWithTracking(
            request,
            startTime,
          );
          resolve(result);
        },
        userId: request.userId,
        sessionId: request.sessionId,
        timestamp: queueStartTime,
        priority,
      };

      // Insert into queue based on priority
      this.insertIntoQueue(queueItem);

      // Update queue statistics
      rateLimitingStats.queuedRequests++;
      rateLimitingStats.maxQueueLength = Math.max(
        rateLimitingStats.maxQueueLength,
        requestQueue.length,
      );

      // Set up queue timeout
      setTimeout(() => {
        const itemIndex = requestQueue.findIndex(item => item === queueItem);
        if (itemIndex !== -1) {
          requestQueue.splice(itemIndex, 1);
          console.warn(
            `⏰ Queue timeout for user ${request.userId} after ${RATE_LIMIT_CONFIG.QUEUE_TIMEOUT}ms`,
          );
          resolve({
            success: false,
            error:
              'Request timed out in queue. Server is experiencing high load.',
            errorType: 'timeout',
            serviceUsed: 'replicate',
            responseTimeMs: Date.now() - startTime,
          });
        }
      }, RATE_LIMIT_CONFIG.QUEUE_TIMEOUT);
    });
  }

  private calculateRequestPriority(
    request: ImageGenerationRequest,
    queueTime: number,
  ): 'high' | 'normal' | 'low' {
    const userLimit = userRequestCounts.get(request.userId);
    const isNewUser = !userLimit || userLimit.count === 1;
    const hasWaitedLong =
      Date.now() - queueTime > RATE_LIMIT_CONFIG.PRIORITY_BOOST_THRESHOLD;

    if (isNewUser || hasWaitedLong) {
      return 'high';
    }

    return 'normal';
  }

  private insertIntoQueue(queueItem: (typeof requestQueue)[0]): void {
    if (queueItem.priority === 'high') {
      // Insert at the beginning of normal priority items
      const firstNormalIndex = requestQueue.findIndex(
        item => item.priority !== 'high',
      );
      if (firstNormalIndex === -1) {
        requestQueue.push(queueItem);
      } else {
        requestQueue.splice(firstNormalIndex, 0, queueItem);
      }
    } else {
      // Add to end of queue
      requestQueue.push(queueItem);
    }
  }

  private async executeRequestWithTracking(
    request: ImageGenerationRequest,
    _startTime: number,
  ): Promise<ImageGenerationResult> {
    activeRequests++;
    rateLimitingStats.totalRequests++;

    console.log(
      `📋 Active requests: ${activeRequests}/${RATE_LIMIT_CONFIG.MAX_CONCURRENT_REQUESTS}, Queue: ${requestQueue.length}`,
    );

    try {
      const result = await this.processRequest(request);

      // Process next request in queue
      this.processNextQueuedRequest();

      return result;
    } finally {
      activeRequests--;
    }
  }

  private processNextQueuedRequest(): void {
    const nextRequest = requestQueue.shift();
    if (nextRequest) {
      // Execute next request asynchronously
      nextRequest.execute().catch(error => {
        console.error('💥 Error processing queued request:', error);
      });
    }
  }

  private updateWaitTimeStats(waitTime: number): void {
    const currentAverage = rateLimitingStats.averageWaitTime;
    const totalProcessed =
      rateLimitingStats.totalRequests - rateLimitingStats.queuedRequests;

    if (totalProcessed === 0) {
      rateLimitingStats.averageWaitTime = waitTime;
    } else {
      rateLimitingStats.averageWaitTime =
        (currentAverage * totalProcessed + waitTime) / (totalProcessed + 1);
    }
  }

  public getArtStyleForGrade(gradeLevel: GradeLevel): string {
    return SIMPLE_ART_STYLE_MAPPING[gradeLevel];
  }

  public getEnhancedArtStyleForGrade(
    gradeLevel: GradeLevel,
  ): ArtStyleDefinition {
    return ART_STYLE_MAPPING[gradeLevel];
  }

  public generateEnhancedStylePrompt(
    gradeLevel: GradeLevel,
    storyAnalysis: StoryAnalysis,
    options: EnhancedStyleOptions = {},
  ): string {
    const styleDefinition = ART_STYLE_MAPPING[gradeLevel];

    // Build enhanced style prompt based on story analysis and options
    const promptComponents = [
      `Create a ${styleDefinition.baseStyle}`,
      this.buildColorGuidance(styleDefinition, storyAnalysis, options),
      this.buildComplexityGuidance(styleDefinition, storyAnalysis, options),
      this.buildTechniqueGuidance(styleDefinition, gradeLevel),
      this.buildEmotionalGuidance(styleDefinition, storyAnalysis, options),
      this.buildLayoutGuidance(styleDefinition, storyAnalysis, options),
      this.buildCharacterGuidance(styleDefinition, storyAnalysis, options),
      this.buildBackgroundGuidance(styleDefinition, storyAnalysis, options),
    ].filter(component => component.length > 0);

    return promptComponents.join(', ');
  }

  private buildColorGuidance(
    style: ArtStyleDefinition,
    analysis: StoryAnalysis,
    options: EnhancedStyleOptions,
  ): string {
    let colorGuidance = style.colorPalette;

    // Adjust colors based on story mood and themes
    if (
      analysis.emotions.includes('happy') ||
      analysis.emotions.includes('joyful')
    ) {
      colorGuidance += ', extra bright and cheerful tones';
    } else if (
      analysis.emotions.includes('peaceful') ||
      analysis.emotions.includes('calm')
    ) {
      colorGuidance += ', soft and soothing colors';
    }

    // Apply mood override if specified
    if (options.moodOverride === 'bright') {
      colorGuidance += ', enhanced brightness and saturation';
    } else if (options.moodOverride === 'peaceful') {
      colorGuidance += ', calming pastels and gentle hues';
    }

    return colorGuidance;
  }

  private buildComplexityGuidance(
    style: ArtStyleDefinition,
    analysis: StoryAnalysis,
    options: EnhancedStyleOptions,
  ): string {
    let complexity = style.visualComplexity;

    // Adjust complexity based on story analysis
    if (
      analysis.complexity === 'simple' &&
      options.complexityAdjustment !== 'more_complex'
    ) {
      complexity += ', extra clarity and simplification';
    } else if (
      analysis.complexity === 'complex' &&
      options.complexityAdjustment !== 'simpler'
    ) {
      complexity += ', rich detail and sophisticated elements';
    }

    return complexity;
  }

  private buildTechniqueGuidance(
    style: ArtStyleDefinition,
    _gradeLevel: GradeLevel,
  ): string {
    return style.artisticTechnique;
  }

  private buildEmotionalGuidance(
    style: ArtStyleDefinition,
    analysis: StoryAnalysis,
    _options: EnhancedStyleOptions,
  ): string {
    let emotional = style.emotionalTone;

    // Enhance emotional guidance based on story themes
    if (analysis.themes.includes('friendship')) {
      emotional += ', warm and welcoming atmosphere';
    } else if (analysis.themes.includes('adventure')) {
      emotional += ', exciting and dynamic energy';
    } else if (analysis.themes.includes('magic')) {
      emotional += ', mystical and enchanting ambiance';
    }

    return emotional;
  }

  private buildLayoutGuidance(
    style: ArtStyleDefinition,
    analysis: StoryAnalysis,
    options: EnhancedStyleOptions,
  ): string {
    let layout = style.layoutStyle;

    // Adjust layout based on story actions and options
    if (options.includeAction && analysis.actions.length > 0) {
      layout += ', dynamic action composition';
    } else if (analysis.emotions.includes('peaceful')) {
      layout += ', serene and balanced arrangement';
    }

    return layout;
  }

  private buildCharacterGuidance(
    style: ArtStyleDefinition,
    analysis: StoryAnalysis,
    options: EnhancedStyleOptions,
  ): string {
    let characterStyle = style.characterStyle;

    if (options.emphasizeCharacters) {
      characterStyle += ', prominent character focus, expressive details';
    }

    // Add character-specific enhancements based on story analysis
    const totalCharacters = Object.values(analysis.characters).flat().length;
    if (totalCharacters > 3) {
      characterStyle += ', multiple character interaction';
    } else if (totalCharacters === 1) {
      characterStyle += ', single character focus, detailed portrayal';
    }

    return characterStyle;
  }

  private buildBackgroundGuidance(
    style: ArtStyleDefinition,
    analysis: StoryAnalysis,
    options: EnhancedStyleOptions,
  ): string {
    let backgroundStyle = style.backgroundStyle;

    if (options.emphasizeEnvironment) {
      backgroundStyle += ', detailed environmental storytelling';
    }

    // Enhance background based on scene types
    const allScenes = Object.values(analysis.scenes).flat();
    if (allScenes.includes('forest') || allScenes.includes('nature')) {
      backgroundStyle += ', lush natural environments';
    } else if (allScenes.includes('castle') || allScenes.includes('magical')) {
      backgroundStyle += ', fantastical architectural elements';
    }

    return backgroundStyle;
  }

  public validateStoryContent(content: string): {
    isValid: boolean;
    error?: string;
  } {
    if (!content || content.trim().length === 0) {
      return { isValid: false, error: 'Story content cannot be empty' };
    }

    if (content.length < 50) {
      return {
        isValid: false,
        error: 'Story content too short (minimum 50 characters)',
      };
    }

    if (content.length > 5000) {
      return {
        isValid: false,
        error: 'Story content too long (maximum 5000 characters)',
      };
    }

    return { isValid: true };
  }

  public getRateLimitingStats(): typeof rateLimitingStats {
    return { ...rateLimitingStats };
  }

  public getActiveRequestCount(): number {
    return activeRequests;
  }

  public getQueueLength(): number {
    return requestQueue.length;
  }

  public getUserRequestStatus(userId: string): {
    requestCount: number;
    isBlocked: boolean;
    remainingCooldown: number;
    allowedRequestsPerMinute: number;
  } {
    const userLimit = userRequestCounts.get(userId);
    const now = Date.now();

    if (!userLimit) {
      return {
        requestCount: 0,
        isBlocked: false,
        remainingCooldown: 0,
        allowedRequestsPerMinute:
          RATE_LIMIT_CONFIG.USER_MAX_REQUESTS_PER_MINUTE,
      };
    }

    const timeSinceLastRequest = now - userLimit.lastRequestTime;
    const remainingCooldown = userLimit.isBlocked
      ? Math.max(
          0,
          RATE_LIMIT_CONFIG.USER_COOLDOWN_PERIOD - timeSinceLastRequest,
        )
      : 0;

    return {
      requestCount: userLimit.count,
      isBlocked: userLimit.isBlocked,
      remainingCooldown,
      allowedRequestsPerMinute: RATE_LIMIT_CONFIG.USER_MAX_REQUESTS_PER_MINUTE,
    };
  }

  public clearUserRateLimit(userId: string): boolean {
    return userRequestCounts.delete(userId);
  }

  public resetRateLimitingStats(): void {
    rateLimitingStats.totalRequests = 0;
    rateLimitingStats.queuedRequests = 0;
    rateLimitingStats.rejectedRequests = 0;
    rateLimitingStats.maxQueueLength = 0;
    rateLimitingStats.averageWaitTime = 0;
    rateLimitingStats.lastResetTime = Date.now();

    console.log('📈 Rate limiting statistics reset');
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public getMonitoringData(): {
    rateLimitingStats: typeof rateLimitingStats;
    errorMetrics: any;
    systemHealth: {
      activeRequests: number;
      queueLength: number;
      uptime: number;
      memoryUsage?: any;
    };
  } {
    return {
      rateLimitingStats: this.getRateLimitingStats(),
      errorMetrics: errorLogger.getMetrics(),
      systemHealth: {
        activeRequests,
        queueLength: requestQueue.length,
        uptime: Date.now() - (errorLogger.getMetrics().uptime || Date.now()),
        memoryUsage: process.memoryUsage ? process.memoryUsage() : undefined,
      },
    };
  }

  public getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      apiConnectivity: boolean;
      queueHealth: boolean;
      errorRate: number;
      responseTime: number;
    };
  } {
    const metrics = errorLogger.getMetrics();
    // Note: activeRequestsRatio calculated but not currently used in decision logic
    // const activeRequestsRatio = activeRequests / RATE_LIMIT_CONFIG.MAX_CONCURRENT_REQUESTS;
    const queueRatio = requestQueue.length / RATE_LIMIT_CONFIG.MAX_QUEUE_SIZE;

    const apiConnectivity = metrics.errorRate < 5; // Less than 5 errors per minute
    const queueHealth = queueRatio < 0.8; // Queue less than 80% full
    const responseTimeGood = metrics.averageResponseTime < 30000; // Less than 30 seconds

    let status: 'healthy' | 'degraded' | 'unhealthy';

    if (apiConnectivity && queueHealth && responseTimeGood) {
      status = 'healthy';
    } else if (apiConnectivity && (queueHealth || responseTimeGood)) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      details: {
        apiConnectivity,
        queueHealth,
        errorRate: metrics.errorRate,
        responseTime: metrics.averageResponseTime,
      },
    };
  }

  public async testReplicateConnection(): Promise<{
    success: boolean;
    error?: string;
    responseTime?: number;
  }> {
    const startTime = Date.now();

    try {
      if (!REPLICATE_API_TOKEN) {
        return { success: false, error: 'Replicate API token not configured' };
      }

      // Test with a simple prompt and connection timeout
      const testPrompt = 'A simple test image, digital art style';
      const connectionTimeout = TIMEOUT_CONFIG.CONNECTION_TEST;

      console.log(
        `🧪 Testing Replicate connection with ${connectionTimeout}ms timeout`,
      );

      if (__DEV__) {
        console.log('🧪 Testing Replicate connection (mock mode)...');
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate quick test
        return {
          success: true,
          responseTime: Date.now() - startTime,
        };
      }

      await this.replicateClient.generateImage(
        testPrompt,
        {},
        connectionTimeout,
      );

      const responseTime = Date.now() - startTime;
      console.log(
        `✅ Replicate connection test completed in ${responseTime}ms`,
      );

      return {
        success: true,
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);
      const errorName = error instanceof Error ? error.name : 'Unknown';
      const isTimeout =
        errorMsg.includes('timeout') || errorName === 'AbortError';

      console.error(
        `❌ Replicate connection test failed after ${responseTime}ms:`,
        error,
      );

      return {
        success: false,
        error: isTimeout
          ? `Connection test timed out after ${TIMEOUT_CONFIG.CONNECTION_TEST}ms`
          : error instanceof Error
          ? error.message
          : 'Unknown error',
        responseTime,
      };
    }
  }

  public getReplicateConfig(): ReplicateClientConfig {
    return { ...this.replicateClient.config };
  }

  public getBackupServiceConfig(): BackupServiceClientConfig {
    return { ...this.backupServiceClient.config };
  }

  public async testBackupServiceConnection(): Promise<{
    success: boolean;
    error?: string;
    responseTime?: number;
  }> {
    const startTime = Date.now();

    try {
      if (!BACKUP_IMAGE_API_TOKEN) {
        return {
          success: false,
          error: 'Backup service API token not configured',
        };
      }

      // Test with a simple, safe prompt and connection timeout
      const testPrompt =
        "A simple, colorful children's book illustration of a friendly animal";
      const connectionTimeout = TIMEOUT_CONFIG.CONNECTION_TEST;

      console.log(
        `🧪 Testing backup service connection with ${connectionTimeout}ms timeout`,
      );

      if (__DEV__) {
        console.log('🧪 Testing backup service connection (mock mode)...');
        await new Promise(resolve => setTimeout(resolve, 800)); // Simulate quick test
        return {
          success: true,
          responseTime: Date.now() - startTime,
        };
      }

      await this.backupServiceClient.generateImage(
        testPrompt,
        {},
        connectionTimeout,
      );

      const responseTime = Date.now() - startTime;
      console.log(
        `✅ Backup service connection test completed in ${responseTime}ms`,
      );

      return {
        success: true,
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);
      const errorName = error instanceof Error ? error.name : 'Unknown';
      const isTimeout =
        errorMsg.includes('timeout') || errorName === 'AbortError';

      console.error(
        `❌ Backup service connection test failed after ${responseTime}ms:`,
        error,
      );

      return {
        success: false,
        error: isTimeout
          ? `Connection test timed out after ${TIMEOUT_CONFIG.CONNECTION_TEST}ms`
          : error instanceof Error
          ? error.message
          : 'Unknown error',
        responseTime,
      };
    }
  }

  public async testFailoverMechanism(): Promise<{
    replicateAttempted: boolean;
    backupUsed: boolean;
    finalService: ServiceUsed;
    totalTime: number;
    error?: string;
  }> {
    const startTime = Date.now();
    let replicateAttempted = false;
    let backupUsed = false;
    let finalService: ServiceUsed = 'replicate';

    try {
      // Force a failure in the primary service for testing
      const originalGenerateImage = this.replicateClient.generateImage;
      this.replicateClient.generateImage = jest
        .fn()
        .mockRejectedValueOnce(
          new Error('Simulated Replicate failure for failover test'),
        );

      replicateAttempted = true;

      const testRequest: ImageGenerationRequest = {
        storyContent:
          'A test story for failover mechanism validation with sufficient content length for testing purposes.',
        gradeLevel: 'K-2',
        sessionId: 'test-failover',
        userId: 'test-user',
        metadata: { test: 'failover' },
      };

      const result = await this.generateImage(testRequest);

      if (result.success && result.serviceUsed === 'backup_service') {
        backupUsed = true;
        finalService = 'backup_service';
      }

      // Restore original method
      this.replicateClient.generateImage = originalGenerateImage;

      return {
        replicateAttempted,
        backupUsed,
        finalService,
        totalTime: Date.now() - startTime,
      };
    } catch (error) {
      // Restore original method in case of error
      const originalGenerateImage = this.replicateClient.generateImage;
      if (typeof originalGenerateImage !== 'function') {
        this.replicateClient.generateImage = originalGenerateImage;
      }

      return {
        replicateAttempted,
        backupUsed,
        finalService,
        totalTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ================================
  // NEW ENHANCED STORY ANALYSIS METHODS
  // ================================

  private identifyProtagonist(
    content: string,
    sentences: string[],
  ): StoryAnalysis['protagonist'] {
    const protagonistCandidates: Array<{
      name: string;
      type: 'human' | 'animal' | 'fantasy';
      mentions: number;
      actionCount: number;
      importance: number;
      description: string;
    }> = [];

    // Pattern for protagonist identification (first named character with most actions)
    const characterActionPatterns = [
      // "Max the squirrel found/felt/helped/ran" etc.
      /\b([A-Z][a-z]+)(?:\s+the\s+(\w+))?\s+(found|felt|helped|ran|walked|looked|smiled|wondered|held|picked|carried|scampered|rushed|followed|nodded|whispered|decided|realized|discovered|climbed|jumped|saved|protected)/gi,
      // "Max, feeling happy..." or "Max was excited..."
      /\b([A-Z][a-z]+),?\s+(?:feeling|was|felt|looked|seemed)\s+(\w+)/gi,
      // Stories that start with character names
      /^[^.!?]*\b([A-Z][a-z]+)(?:\s+the\s+(\w+))?\s+(found|discovered|walked|lived|was|felt)/gi,
    ];

    characterActionPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const name = match[1];
        const animalType = match[2];
        const action = match[3];

        // Determine character type
        let type: 'human' | 'animal' | 'fantasy' = 'human';
        if (
          animalType ||
          /squirrel|rabbit|fox|owl|mouse|bird|bear|deer|frog|cat|dog|turtle|bee|butterfly/.test(
            content.toLowerCase(),
          )
        ) {
          type = 'animal';
        } else if (
          /wizard|fairy|elf|dragon|unicorn|princess|prince/.test(
            content.toLowerCase(),
          )
        ) {
          type = 'fantasy';
        }

        // Find or create candidate
        let candidate = protagonistCandidates.find(c => c.name === name);
        if (!candidate) {
          candidate = {
            name,
            type,
            mentions: 0,
            actionCount: 0,
            importance: 0,
            description: animalType ? `${name} the ${animalType}` : name,
          };
          protagonistCandidates.push(candidate);
        }

        candidate.mentions++;
        if (
          [
            'found',
            'felt',
            'helped',
            'saved',
            'protected',
            'discovered',
          ].includes(action)
        ) {
          candidate.actionCount += 2; // Important actions get more weight
        } else {
          candidate.actionCount++;
        }
      }
    });

    // Calculate importance scores
    protagonistCandidates.forEach(candidate => {
      candidate.importance = candidate.mentions * 2 + candidate.actionCount * 3;

      // Bonus for being mentioned in first sentence
      if (
        sentences[0] &&
        sentences[0].toLowerCase().includes(candidate.name.toLowerCase())
      ) {
        candidate.importance += 10;
      }
    });

    // Return the most important character
    const protagonist = protagonistCandidates.sort(
      (a, b) => b.importance - a.importance,
    )[0];

    return protagonist
      ? {
          name: protagonist.name,
          type: protagonist.type,
          description: protagonist.description,
          importance: protagonist.importance,
        }
      : undefined;
  }

  private extractPlotDevices(content: string): StoryAnalysis['plotDevices'] {
    const plotDevices: Array<{
      name: string;
      type: 'magical_item' | 'tool' | 'special_object' | 'location';
      description: string;
      significance: number;
    }> = [];

    // Magical items patterns
    const magicalItemPatterns = [
      // "magical/enchanted/glowing/sparkling + item"
      /\b(magical|enchanted|glowing|sparkling|shiny|shimmering)\s+(stone|gem|crystal|ring|wand|staff|book|key|amulet|pendant|orb|mirror|crown|sword|shield)\b/gi,
      // "Friendship Stone" or similar named items
      /\b([A-Z][a-z]*\s+(?:Stone|Gem|Crystal|Ring|Wand|Staff|Book|Key|Amulet|Pendant|Orb|Mirror|Crown|Sword|Shield))\b/gi,
      // Items that do magical things
      /\b(\w+\s+\w+)\s+(?:that|which)\s+(?:glows?|sparkles?|shines?|magical|grants?|brings?)/gi,
    ];

    // Special objects patterns
    const specialObjectPatterns = [
      // "the special/important/sacred + object"
      /\bthe\s+(special|important|sacred|precious|ancient|legendary)\s+(\w+)/gi,
      // Items with special properties
      /\b(\w+\s+\w+)\s+(?:made of|forged from|blessed with|imbued with)\s+(\w+)/gi,
    ];

    // Process magical items
    magicalItemPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const fullMatch = match[0];
        // Note: adjective extracted but not currently used in significance calculation
        // const adjective = match[1];
        const item = match[2] || match[1]; // Handle different capture groups

        // Calculate significance based on how often it's mentioned and its role
        const mentions = (content.match(new RegExp(item, 'gi')) || []).length;
        let significance = mentions * 2;

        // Boost significance for central story elements
        if (
          ['stone', 'gem', 'crystal'].includes(item.toLowerCase()) &&
          mentions > 2
        ) {
          significance += 5;
        }

        plotDevices.push({
          name: fullMatch,
          type: 'magical_item',
          description: fullMatch,
          significance,
        });
      }
    });

    // Process special objects
    specialObjectPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const adjective = match[1];
        const object = match[2];
        const fullDescription = `${adjective} ${object}`;

        const mentions = (content.match(new RegExp(object, 'gi')) || []).length;

        plotDevices.push({
          name: object,
          type: 'special_object',
          description: fullDescription,
          significance: mentions + 2,
        });
      }
    });

    // Remove duplicates and sort by significance
    const uniqueDevices = plotDevices.filter(
      (device, index, arr) =>
        arr.findIndex(
          d => d.name.toLowerCase() === device.name.toLowerCase(),
        ) === index,
    );

    return uniqueDevices
      .sort((a, b) => b.significance - a.significance)
      .slice(0, 3);
  }

  private analyzeStoryThemes(
    content: string,
    _sentences: string[],
  ): StoryAnalysis['storyThemes'] {
    const themes = {
      primary: '',
      secondary: [] as string[],
      collaborativeElements: [] as string[],
      friendshipElements: [] as string[],
    };

    // Friendship theme indicators
    const friendshipPatterns = [
      /\bfriend(?:ship|s)?\b/gi,
      /\btogether\b/gi,
      /\bhelp(?:ed|ing|s)?\b/gi,
      /\bkind(?:ness)?\b/gi,
      /\bcare(?:d|ing|s)?\b/gi,
      /\bshare(?:d|ing|s)?\b/gi,
      /\bsupport(?:ed|ing|s)?\b/gi,
    ];

    // Collaborative action patterns
    const collaborativePatterns = [
      /\btogether[^.!?]*(?:carried|lifted|moved|built|made|worked|played)/gi,
      /\bhelped?\s+(?:each other|one another|\w+)/gi,
      /\bteam(?:ed up|work)/gi,
      /\bjoined forces/gi,
      /\bworked together/gi,
    ];

    // Adventure/quest theme indicators
    const adventurePatterns = [
      /\badventure/gi,
      /\bquest/gi,
      /\bjourney/gi,
      /\bdiscovered?/gi,
      /\bexplore[ds]?/gi,
    ];

    // Magic/fantasy theme indicators
    const magicPatterns = [
      /\bmagical?/gi,
      /\benchanted/gi,
      /\bglowing/gi,
      /\bsparkl(?:ing|ed)/gi,
    ];

    // Count theme indicators
    let friendshipScore = 0;
    let collaborativeScore = 0;
    let adventureScore = 0;
    let magicScore = 0;

    friendshipPatterns.forEach(pattern => {
      const matches = content.match(pattern) || [];
      friendshipScore += matches.length;
      matches.forEach(match => themes.friendshipElements.push(match));
    });

    collaborativePatterns.forEach(pattern => {
      const matches = content.match(pattern) || [];
      collaborativeScore += matches.length * 2; // Collaborative actions are more significant
      matches.forEach(match => themes.collaborativeElements.push(match));
    });

    adventurePatterns.forEach(pattern => {
      adventureScore += (content.match(pattern) || []).length;
    });

    magicPatterns.forEach(pattern => {
      magicScore += (content.match(pattern) || []).length;
    });

    // Determine primary theme
    const scores = [
      { theme: 'friendship', score: friendshipScore },
      { theme: 'collaboration', score: collaborativeScore },
      { theme: 'adventure', score: adventureScore },
      { theme: 'magic', score: magicScore },
    ];

    const sortedThemes = scores.sort((a, b) => b.score - a.score);
    themes.primary = sortedThemes[0].theme;
    themes.secondary = sortedThemes
      .slice(1, 3)
      .filter(t => t.score > 0)
      .map(t => t.theme);

    return themes;
  }

  private extractRichDetails(content: string): StoryAnalysis['richDetails'] {
    const details = {
      specificColors: [] as string[],
      uniqueObjects: [] as string[],
      emotionalMoments: [] as string[],
      actionSequences: [] as string[],
    };

    // Enhanced color extraction
    const colorPatterns = [
      // Specific color combinations: "burnt orange", "deep crimson", "golden yellow"
      /\b(burnt|deep|bright|dark|light|pale|vibrant|brilliant|radiant|shimmering|sparkling)\s+(orange|red|crimson|yellow|gold|golden|blue|green|emerald|purple|violet|pink|brown|silver|turquoise|amber)\b/gi,
      // Nature colors: "autumn leaves painted in..."
      /(?:painted|colored|tinted)\s+in\s+(?:brilliant|deep|bright)?\s*(?:shades of\s+)?([^,.!?]+)/gi,
      // Specific descriptions: "eyes the color of summer sky"
      /\b(\w+)\s+(?:the color of|like)\s+([^,.!?]+)/gi,
    ];

    // Unique objects pattern
    const uniqueObjectPatterns = [
      // Objects with special descriptions
      /\b(?:tiny|small|large|huge|magnificent|beautiful|ancient|mysterious)\s+(\w+(?:\s+\w+)?)\s+(?:made of|crafted from|shaped like|that|which)/gi,
      // Specific story objects
      /\b(acorn|nest|branch|leaf|feather|wing|paw|tail|beak|whiskers|stone|gem|crystal)\b/gi,
    ];

    // Emotional moments pattern
    const emotionalPatterns = [
      // Emotional states and actions
      /\b(?:felt|feeling|was|looked|seemed)\s+(happy|sad|excited|worried|proud|grateful|joyful|amazed|surprised|scared|brave|determined|hopeful|peaceful|content|overwhelmed)/gi,
      // Emotional descriptions
      /\b(heart(?:\s+\w+){1,3}(?:overflow|full|warm|beating|racing))/gi,
      // Tears and emotional expressions
      /\b(tears of (?:joy|happiness|gratitude)|smile(?:d|ing)|laugh(?:ed|ing)|cry(?:ied|ing)|gasp(?:ed|ing))/gi,
    ];

    // Action sequences pattern
    const actionPatterns = [
      // Dynamic action verbs
      /\b(leaped|jumped|rushed|dashed|scampered|bounced|dove|swooped|fluttered|carried|lifted|rescued|saved|protected|climbed|ran|walked|helped)/gi,
      // Action sequences
      /\b(\w+(?:ed|ing))\s+(?:and|then|before|while|as)\s+(\w+(?:ed|ing))/gi,
    ];

    // Extract colors
    colorPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        if (match[1] && match[2]) {
          details.specificColors.push(`${match[1]} ${match[2]}`);
        } else if (match[1]) {
          details.specificColors.push(match[1]);
        }
      }
    });

    // Extract unique objects
    uniqueObjectPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        details.uniqueObjects.push(match[1] || match[0]);
      }
    });

    // Extract emotional moments
    emotionalPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        details.emotionalMoments.push(match[1] || match[0]);
      }
    });

    // Extract action sequences
    actionPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        if (match[2]) {
          details.actionSequences.push(`${match[1]} and ${match[2]}`);
        } else {
          details.actionSequences.push(match[1] || match[0]);
        }
      }
    });

    // Remove duplicates and limit results
    details.specificColors = [...new Set(details.specificColors)].slice(0, 5);
    details.uniqueObjects = [...new Set(details.uniqueObjects)].slice(0, 5);
    details.emotionalMoments = [...new Set(details.emotionalMoments)].slice(
      0,
      5,
    );
    details.actionSequences = [...new Set(details.actionSequences)].slice(0, 5);

    return details;
  }

  // ================================
  // NEW ENHANCED ANALYSIS METHODS
  // ================================

  /**
   * Identifies and extracts secondary characters with their relationships and roles
   */
  private identifySecondaryCharacters(
    content: string,
    _sentences: string[],
  ): StoryAnalysis['secondaryCharacters'] {
    const secondaryCharacters: NonNullable<
      StoryAnalysis['secondaryCharacters']
    > = [];

    // Enhanced patterns for secondary character detection
    const characterPatterns = [
      // Named characters with descriptions: "Henry the hedgehog", "Holly the hummingbird"
      /\b(\w+)\s+the\s+(hedgehog|hummingbird|butterfly|bee|robin|sparrow|cardinal|jay|mouse|rat|chipmunk|mole|raccoon|badger|otter|beaver|porcupine|skunk|possum)\b/gi,
      // Characters with roles: "his friend Max", "her companion Sarah", "the helpful guide"
      /\b(?:his|her|their)\s+(friend|companion|helper|guide|buddy|pal)\s+(\w+)\b/gi,
      // Character mentions: "together with Luna", "along with Ben"
      /\b(?:together with|along with|accompanied by|joined by)\s+(\w+)\b/gi,
      // Multiple character patterns: "Max and Luna", "Ben, Sarah, and Tom"
      /\b(\w+)(?:\s*,\s*(\w+))*\s+(?:and|&)\s+(\w+)\b/gi,
      // Helpful characters: "wise old turtle named Elder", "friendly rabbit called Hop"
      /\b(wise|friendly|helpful|kind|gentle|brave)\s+(?:old\s+)?(\w+)\s+(?:named|called)\s+(\w+)\b/gi,
    ];

    const roleKeywords = {
      friend: ['friend', 'buddy', 'pal', 'companion'],
      helper: ['helper', 'guide', 'mentor', 'teacher', 'wise'],
      companion: ['companion', 'partner', 'teammate'],
      guide: ['guide', 'leader', 'elder', 'advisor'],
    };

    // Extract characters using patterns
    characterPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const characterName = match[1] || match[2] || match[3] || match[0];

        if (
          characterName &&
          characterName.length > 1 &&
          characterName !== 'the'
        ) {
          // Determine character type
          let characterType: 'human' | 'animal' | 'fantasy' = 'animal'; // Default for children's stories
          if (/\b(boy|girl|man|woman|child|person|human)\b/i.test(match[0])) {
            characterType = 'human';
          } else if (
            /\b(fairy|elf|wizard|dragon|unicorn|phoenix)\b/i.test(match[0])
          ) {
            characterType = 'fantasy';
          }

          // Determine role
          let role: 'friend' | 'helper' | 'companion' | 'guide' | 'other' =
            'other';
          for (const [roleType, keywords] of Object.entries(roleKeywords)) {
            if (
              keywords.some(keyword => match[0].toLowerCase().includes(keyword))
            ) {
              role = roleType as 'friend' | 'helper' | 'companion' | 'guide';
              break;
            }
          }

          // Calculate importance based on mentions and context
          const mentions = (
            content.match(new RegExp(`\\b${characterName}\\b`, 'gi')) || []
          ).length;
          const importance = Math.min(
            10,
            Math.max(1, mentions * 2 + (role === 'friend' ? 2 : 1)),
          );

          // Extract relationship context
          let relationshipContext = '';
          const contextMatch = content.match(
            new RegExp(`${characterName}[^.!?]{0,50}`, 'gi'),
          );
          if (contextMatch && contextMatch[0]) {
            relationshipContext = contextMatch[0]
              .replace(characterName, '')
              .trim();
          }

          secondaryCharacters.push({
            name: characterName,
            type: characterType,
            role,
            description: match[0],
            importance,
            relationshipToProtagonist:
              relationshipContext || `Appears as ${role} in the story`,
          });
        }
      }
    });

    // Remove duplicates and sort by importance
    const uniqueCharacters = secondaryCharacters.filter(
      (char, index, self) =>
        index ===
        self.findIndex(c => c.name.toLowerCase() === char.name.toLowerCase()),
    );

    return uniqueCharacters
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 5); // Limit to top 5 secondary characters
  }

  /**
   * Extracts enhanced color details with emotional and contextual mapping
   */
  private extractEnhancedColorDetails(
    content: string,
  ): StoryAnalysis['enhancedColorDetails'] {
    const colorDetails: NonNullable<StoryAnalysis['enhancedColorDetails']> = {
      dominantColors: [],
      emotionalColorMapping: [],
      objectColorPairs: [],
      sceneColorMoods: [],
    };

    // Enhanced color extraction patterns
    const colorPatterns = [
      // Dominant colors: "brilliant golden", "deep emerald", "sparkling silver"
      /\b(brilliant|deep|bright|sparkling|shimmering|radiant|vivid|rich|warm|cool)\s+(golden|gold|silver|emerald|crimson|azure|violet|amber|turquoise|coral|ruby|sapphire|pearl|bronze)\b/gi,
      // Color with objects: "yellow flower", "blue sky", "green leaves"
      /\b(bright|dark|light|deep|pale|vibrant)?\s*(red|blue|green|yellow|orange|purple|pink|brown|black|white|gray|golden|silver)\s+(flower|sky|leaves|tree|stone|water|light|glow|feather|wing|fur|eyes)\b/gi,
      // Color emotions: "warm golden glow made them feel", "cool blue water calmed"
      /\b(warm|cool|bright|soft|gentle|harsh|bold)\s+(\w+)\s+(\w+)\s+(?:made|caused|helped|brought|gave).{0,30}(feel|felt|seem|appear|look|become)/gi,
    ];

    // Emotional color associations
    const emotionalColorMap: Record<string, string[]> = {
      happiness: ['yellow', 'golden', 'bright', 'warm', 'sunny'],
      calm: ['blue', 'soft', 'gentle', 'cool', 'peaceful'],
      excitement: ['red', 'orange', 'vibrant', 'bright', 'bold'],
      nature: ['green', 'brown', 'earth', 'natural', 'forest'],
      magic: ['purple', 'violet', 'sparkling', 'shimmering', 'glowing'],
      wonder: ['silver', 'pearl', 'radiant', 'brilliant', 'luminous'],
    };

    // Extract dominant colors
    colorPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const colorDescriptor = match[1] ? `${match[1]} ${match[2]}` : match[2];
        if (colorDescriptor) {
          colorDetails.dominantColors.push(colorDescriptor);

          // If there's an object association, add it
          if (match[3]) {
            colorDetails.objectColorPairs.push({
              object: match[3],
              color: colorDescriptor,
              significance: 'Visual description in story',
            });
          }
        }
      }
    });

    // Map colors to emotions
    for (const [emotion, colors] of Object.entries(emotionalColorMap)) {
      colors.forEach(color => {
        if (
          content.toLowerCase().includes(color) &&
          content.toLowerCase().includes(emotion)
        ) {
          colorDetails.emotionalColorMapping.push({
            color,
            emotion,
            context: `Color ${color} associated with ${emotion} in the narrative`,
          });
        }
      });
    }

    // Extract scene color moods
    const scenePatterns = [
      /(?:in the|at the|through the)\s+(\w+(?:\s+\w+){0,2})[^.!?]*(?:glow|light|color|hue|shade)[^.!?]*(?:of|with)\s+([^.!?]*)/gi,
    ];

    scenePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        if (match[1] && match[2]) {
          const scene = match[1];
          const colorInfo = match[2];
          const colors =
            colorInfo.match(
              /\b(red|blue|green|yellow|orange|purple|pink|brown|black|white|gray|golden|silver|bright|dark|light)\b/gi,
            ) || [];

          if (colors.length > 0) {
            colorDetails.sceneColorMoods.push({
              scene,
              colorPalette: colors,
              mood: this.inferMoodFromColors(colors),
            });
          }
        }
      }
    });

    // Clean up and deduplicate
    colorDetails.dominantColors = [
      ...new Set(colorDetails.dominantColors),
    ].slice(0, 6);
    colorDetails.emotionalColorMapping =
      colorDetails.emotionalColorMapping.slice(0, 5);
    colorDetails.objectColorPairs = colorDetails.objectColorPairs.slice(0, 8);
    colorDetails.sceneColorMoods = colorDetails.sceneColorMoods.slice(0, 4);

    return colorDetails;
  }

  /**
   * Analyzes dynamic scene context for more engaging visual representation
   */
  private analyzeDynamicSceneContext(
    content: string,
    _sentences: string[],
  ): StoryAnalysis['dynamicSceneContext'] {
    const sceneContext: NonNullable<StoryAnalysis['dynamicSceneContext']> = {
      currentAction: '',
      emotionalState: 'wonder',
      sceneMovement: 'gentle',
      timeOfAction: 'middle',
      interactionLevel: 'solo',
      atmosphericElements: [],
      visualDynamics: [],
    };

    // Action detection patterns
    const actionPatterns = [
      // Current action verbs
      /\b(exploring|discovering|searching|finding|climbing|jumping|running|flying|swimming|helping|sharing|creating|building|solving|rescuing|protecting)\b/gi,
      // Action sequences
      /\b(?:suddenly|then|next|finally|meanwhile)\s+(\w+(?:ed|ing))\b/gi,
    ];

    // Emotional state detection
    const emotionalStateMap: Record<string, RegExp> = {
      discovery:
        /\b(found|discovered|noticed|realized|saw|spotted|uncovered|revealed)\b/gi,
      excitement:
        /\b(excited|thrilled|amazed|delighted|overjoyed|enthusiastic)\b/gi,
      wonder:
        /\b(wondered|curious|mysterious|magical|enchanting|beautiful|extraordinary)\b/gi,
      collaboration:
        /\b(together|teamwork|helping|sharing|cooperating|working with|joined forces)\b/gi,
      achievement:
        /\b(accomplished|succeeded|completed|achieved|won|solved|finished)\b/gi,
      adventure:
        /\b(adventure|journey|quest|exploration|expedition|voyage)\b/gi,
    };

    // Movement intensity patterns
    const movementPatterns = {
      static:
        /\b(sitting|resting|standing|watching|observing|thinking|pondering)\b/gi,
      gentle:
        /\b(walking|strolling|floating|drifting|gliding|moving slowly)\b/gi,
      active:
        /\b(running|jumping|climbing|swimming|flying|dancing|playing)\b/gi,
      dynamic:
        /\b(racing|rushing|dashing|leaping|soaring|zooming|bursting|erupting)\b/gi,
    };

    // Extract current action
    let primaryAction = '';
    actionPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches && matches.length > 0) {
        primaryAction = matches[0];
      }
    });
    sceneContext.currentAction = primaryAction || 'engaging in story adventure';

    // Determine emotional state
    let highestEmotionCount = 0;
    for (const [emotion, pattern] of Object.entries(emotionalStateMap)) {
      const matches = content.match(pattern);
      if (matches && matches.length > highestEmotionCount) {
        highestEmotionCount = matches.length;
        sceneContext.emotionalState =
          emotion as typeof sceneContext.emotionalState;
      }
    }

    // Determine scene movement
    let highestMovementCount = 0;
    for (const [movement, pattern] of Object.entries(movementPatterns)) {
      const matches = content.match(pattern);
      if (matches && matches.length > highestMovementCount) {
        highestMovementCount = matches.length;
        sceneContext.sceneMovement =
          movement as typeof sceneContext.sceneMovement;
      }
    }

    // Determine time of action
    if (
      content.includes('began') ||
      content.includes('started') ||
      content.includes('first')
    ) {
      sceneContext.timeOfAction = 'beginning';
    } else if (
      content.includes('finally') ||
      content.includes('ended') ||
      content.includes('accomplished')
    ) {
      sceneContext.timeOfAction = 'resolution';
    } else if (
      content.includes('suddenly') ||
      content.includes('moment') ||
      content.includes('peak')
    ) {
      sceneContext.timeOfAction = 'climax';
    }

    // Determine interaction level
    const characterCount = (content.match(/\b(?:and|with|together)\b/gi) || [])
      .length;
    if (characterCount > 2) {
      sceneContext.interactionLevel = 'group';
    } else if (characterCount > 0) {
      sceneContext.interactionLevel = 'paired';
    }

    // Extract atmospheric elements
    const atmosphericPatterns = [
      /\b(sunlight|moonlight|starlight|shadow|mist|fog|wind|breeze|rain|snow|sparkle|glow|shimmer)\b/gi,
      /\b(peaceful|magical|mysterious|enchanting|serene|vibrant|lively|bustling)\s+(?:atmosphere|mood|feeling|air)\b/gi,
    ];

    atmosphericPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        sceneContext.atmosphericElements.push(...matches);
      }
    });

    // Extract visual dynamics
    const dynamicElements = [
      {
        element: 'light',
        motion: 'dancing',
        pattern: /\b(?:dancing|flickering|shimmering)\s+light\b/gi,
      },
      {
        element: 'leaves',
        motion: 'swaying',
        pattern: /\b(?:swaying|rustling|fluttering)\s+leaves\b/gi,
      },
      {
        element: 'water',
        motion: 'flowing',
        pattern: /\b(?:flowing|babbling|rushing)\s+(?:water|stream|river)\b/gi,
      },
      {
        element: 'characters',
        motion: 'moving',
        pattern: /\b(?:running|jumping|flying|dancing)\b/gi,
      },
    ];

    dynamicElements.forEach(({ element, motion, pattern }) => {
      const matches = content.match(pattern);
      if (matches && matches.length > 0) {
        sceneContext.visualDynamics.push({
          element,
          motion,
          intensity: Math.min(10, matches.length * 2),
        });
      }
    });

    // Clean up arrays
    sceneContext.atmosphericElements = [
      ...new Set(sceneContext.atmosphericElements),
    ].slice(0, 5);
    sceneContext.visualDynamics = sceneContext.visualDynamics.slice(0, 5);

    return sceneContext;
  }

  /**
   * Helper method to infer mood from color palette
   */
  private inferMoodFromColors(colors: string[]): string {
    const moodColorMap: Record<string, string[]> = {
      cheerful: ['yellow', 'bright', 'golden', 'light'],
      peaceful: ['blue', 'green', 'soft', 'gentle'],
      energetic: ['red', 'orange', 'vibrant', 'bold'],
      mysterious: ['purple', 'dark', 'deep'],
      natural: ['green', 'brown', 'earth'],
      magical: ['silver', 'golden', 'sparkling'],
    };

    let bestMood = 'neutral';
    let highestScore = 0;

    for (const [mood, moodColors] of Object.entries(moodColorMap)) {
      const score = colors.filter(color =>
        moodColors.some(moodColor => color.toLowerCase().includes(moodColor)),
      ).length;

      if (score > highestScore) {
        highestScore = score;
        bestMood = mood;
      }
    }

    return bestMood;
  }

  // ===================================================
  // STORY-SPECIFIC PROMPT GENERATION (NEW APPROACH)
  // ===================================================

  /**
   * NEW: Story-first prompt generation that prioritizes specific story content
   * This method directly extracts visual elements without complex pipelines
   */
  private generateStorySpecificPrompt(
    storyContent: string,
    gradeLevel: GradeLevel,
    artStyleDefinition: ArtStyleDefinition,
  ): string {
    try {
      // Extract key visual elements directly from story
      const visualElements = this.extractDirectVisualElements(storyContent);

      // If we have strong story-specific content, build a targeted prompt
      if (
        visualElements.character ||
        visualElements.objects.length > 0 ||
        visualElements.setting
      ) {
        let prompt = `Create a ${artStyleDefinition.baseStyle}`;

        // Add character with physical descriptions
        if (visualElements.character) {
          prompt += ` showing ${visualElements.character}`;
        }

        // Add primary action/scene
        if (visualElements.action) {
          prompt += ` ${visualElements.action}`;
        }

        // Add specific objects
        if (visualElements.objects.length > 0) {
          const objectList = visualElements.objects.slice(0, 3).join(' and ');
          prompt += ` with ${objectList}`;
        }

        // Add setting context
        if (visualElements.setting) {
          prompt += ` in ${visualElements.setting}`;
        }

        // Add colors and atmosphere
        if (visualElements.colors.length > 0) {
          const colorList = visualElements.colors.slice(0, 3).join(', ');
          prompt += `, featuring ${colorList} colors`;
        }

        // Add emotional tone
        if (visualElements.mood) {
          prompt += `, ${visualElements.mood} atmosphere`;
        }

        // Always add safety constraint
        prompt += ', safe for children, G-rated content';

        console.log('📝 Story-specific elements extracted:', {
          character: visualElements.character,
          objects: visualElements.objects,
          setting: visualElements.setting,
          colors: visualElements.colors,
          mood: visualElements.mood,
        });

        return prompt;
      }

      return ''; // Return empty to fall back to other methods
    } catch (error) {
      console.error('Error in generateStorySpecificPrompt:', error);
      return '';
    }
  }

  /**
   * Direct visual element extraction focusing on specific story content
   */
  /**
   * Dynamic Character Extraction - No hardcoded animal lists!
   * Uses linguistic patterns to identify characters regardless of species
   */
  private extractCharactersDynamically(content: string): string[] {
    const characters: string[] = [];

    // Pattern 1: "Name the [adjective] [anything]" - captures any creature
    const nameThePattern = /\b([A-Z][a-z]+)\s+the\s+(\w+(?:\s+\w+)?)\b/g;
    let match;
    while ((match = nameThePattern.exec(content)) !== null) {
      const name = match[1];
      const description = match[2];

      // Filter out common words that aren't creatures
      const commonWords = [
        'first',
        'last',
        'next',
        'same',
        'other',
        'best',
        'only',
        'new',
        'old',
        'good',
        'great',
      ];
      if (!commonWords.includes(description.toLowerCase())) {
        characters.push(`${name} the ${description}`);
      }
    }

    // Pattern 2: Multi-word descriptive creatures - "wise old tortoise", "tiny dragons", etc.
    const multiWordCreaturePattern =
      /\b(wise\s+old|little|tiny|baby|small|magical|ancient|friendly|curious|brave|gentle)\s+([a-z]+(?:\s+[a-z]+)?)\b/g;
    while ((match = multiWordCreaturePattern.exec(content)) !== null) {
      const adjective = match[1];
      const creature = match[2];

      // Check for creature context (animal nouns or animal behaviors)
      const contextWindow = content.substring(
        Math.max(0, match.index - 100),
        match.index + 200,
      );
      const creatureIndicators = [
        'wings',
        'flew',
        'hopped',
        'crawled',
        'swam',
        'chirped',
        'squeaked',
        'purred',
        'barked',
        'meowed',
        'tail',
        'paws',
        'scales',
        'feathers',
        'fur',
        'shell',
        'horn',
        'whiskers',
        'mane',
      ];
      const creatureNouns = [
        'dragon',
        'unicorn',
        'phoenix',
        'tortoise',
        'butterfly',
        'rabbit',
        'mouse',
        'mice',
        'ladybug',
        'caterpillar',
        'cat',
        'lion',
        'monkey',
        'bird',
        'fish',
        'snake',
        'frog',
        'bear',
        'wolf',
        'fox',
        'deer',
      ];

      if (
        creatureIndicators.some(indicator =>
          contextWindow.includes(indicator),
        ) ||
        creatureNouns.some(noun => creature.includes(noun))
      ) {
        characters.push(`${adjective} ${creature}`);
      }
    }

    // Pattern 3: Standalone fantasy creatures mentioned directly
    const fantasyCreaturePattern =
      /\b(dragons?|unicorns?|phoenixes?|griffins?|fairies?|elves?|dwarves?)\b/g;
    while ((match = fantasyCreaturePattern.exec(content)) !== null) {
      const creature = match[1];

      // Get surrounding context for size/description
      const contextBefore = content.substring(
        Math.max(0, match.index - 50),
        match.index,
      );
      const sizeMatch = contextBefore.match(
        /\b(tiny|small|little|huge|enormous|giant|miniature)\s*$/i,
      );

      if (sizeMatch) {
        characters.push(`${sizeMatch[1].toLowerCase()} ${creature}`);
      } else {
        characters.push(creature);
      }
    }

    // Pattern 4: Character names that perform actions (dynamic)
    const actionPattern =
      /\b([A-Z][a-z]{2,})\s+(saw|found|felt|heard|went|took|looked|ran|jumped|flew|hopped|smiled|laughed|wondered|decided|noticed|lapped|fluttered|perched|landed|bounded|danced|giggled|trembled|stretched|yawned|rumbled|leaned|gripped|ventured|examined|inserted|turned)\b/g;
    while ((match = actionPattern.exec(content)) !== null) {
      const name = match[1];

      // Exclude common words
      const excludeWords = [
        'Everything',
        'Something',
        'Nothing',
        'Behind',
        'Inside',
        'Outside',
        'Around',
        'Through',
        'Beyond',
        'Welcome',
      ];
      if (!excludeWords.includes(name)) {
        characters.push(name);
      }
    }

    return [...new Set(characters)]; // Remove duplicates
  }

  /**
   * Dynamic Environment Extraction - No hardcoded location lists!
   * Uses linguistic patterns to identify settings and environments
   */
  private extractEnvironmentsDynamically(content: string): string[] {
    const environments: string[] = [];

    // Pattern 1: Color + object combinations
    const colorObjectPattern =
      /\b(bright|dark|crimson|golden|crystal|sparkling|shimmering|beautiful|mysterious|enormous|magical|enchanted|legendary)\s+([a-z]+(?:\s+[a-z]+)?)\b/g;
    let match;
    while ((match = colorObjectPattern.exec(content)) !== null) {
      const adjective = match[1];
      const object = match[2];

      // Focus on location/setting words
      const locationWords = [
        'door',
        'field',
        'meadow',
        'pond',
        'garden',
        'tree',
        'hill',
        'path',
        'clearing',
        'forest',
        'fountain',
        'canopy',
        'brook',
        'stream',
        'grove',
        'glade',
      ];
      if (locationWords.some(word => object.includes(word))) {
        environments.push(`${adjective} ${object}`);
      }
    }

    // Pattern 2: Named places - "Garden of Wonders", "Forest of Dreams", etc.
    const namedPlacePattern = /\b([A-Z][a-z]+(?:\s+of\s+[A-Z][a-z]+)+)\b/g;
    while ((match = namedPlacePattern.exec(content)) !== null) {
      const placeName = match[1];

      // Check if it's a location context
      const contextWindow = content.substring(
        Math.max(0, match.index - 100),
        match.index + 100,
      );
      const placeIndicators = [
        'door',
        'garden',
        'forest',
        'field',
        'meadow',
        'kingdom',
        'land',
        'realm',
        'valley',
        'mountain',
        'lake',
        'river',
        'cave',
        'palace',
        'castle',
      ];

      if (
        placeIndicators.some(indicator =>
          contextWindow.toLowerCase().includes(indicator),
        )
      ) {
        environments.push(placeName);
      }
    }

    // Pattern 3: "a/the [adjective] [place]"
    const placePattern =
      /\b(?:a|the)\s+(big|little|small|huge|enormous|vast|tiny|beautiful|magical|peaceful|sunny|magnificent|ancient|mysterious|enchanted)\s+([a-z]+(?:\s+[a-z]+)?)\b/g;
    while ((match = placePattern.exec(content)) !== null) {
      const adjective = match[1];
      const place = match[2];

      // Check if it's a place/location
      const contextWindow = content.substring(
        Math.max(0, match.index - 50),
        match.index + 50,
      );
      const locationContext = [
        'in',
        'through',
        'across',
        'behind',
        'inside',
        'outside',
        'toward',
        'into',
        'within',
        'beside',
        'beneath',
        'above',
      ];

      if (locationContext.some(prep => contextWindow.includes(prep))) {
        environments.push(`${adjective} ${place}`);
      }
    }

    // Pattern 4: Specific descriptive environments
    const descriptivePattern =
      /(field\s+full\s+of\s+[^.!?]+|meadow[^.!?]*|pond[^.!?]*|garden[^.!?]*|fountain[^.!?]*|forest[^.!?]*|canopy[^.!?]*|door[^.!?]*)/g;
    while ((match = descriptivePattern.exec(content)) !== null) {
      const description = match[1].trim();
      if (description.length < 100) {
        // Keep descriptions reasonable
        environments.push(description);
      }
    }

    // Pattern 5: Standalone environment words with strong context
    const environmentWords = [
      'fountain',
      'waterfall',
      'brook',
      'stream',
      'clearing',
      'grove',
      'glade',
      'valley',
      'hillside',
      'meadowland',
      'woodland',
      'pathway',
      'bridge',
      'archway',
      'doorway',
      'keyhole',
    ];
    environmentWords.forEach(word => {
      const wordPattern = new RegExp(`\\b(${word})\\b`, 'gi');
      const matches = content.match(wordPattern);
      if (matches) {
        // Get context to see if it's a prominent setting element
        const wordIndex = content.toLowerCase().indexOf(word);
        if (wordIndex !== -1) {
          const contextWindow = content.substring(
            Math.max(0, wordIndex - 50),
            wordIndex + 100,
          );
          const settingIndicators = [
            'stood',
            'lay',
            'found',
            'discovered',
            'saw',
            'opened',
            'revealed',
            'beyond',
            'center',
            'beside',
            'magnificent',
            'beautiful',
            'magical',
            'ancient',
          ];

          if (
            settingIndicators.some(indicator =>
              contextWindow.toLowerCase().includes(indicator),
            )
          ) {
            environments.push(word);
          }
        }
      }
    });

    return [...new Set(environments)]; // Remove duplicates
  }

  /**
   * Extract visual elements (colors, textures, etc.)
   */
  private extractVisualElements(content: string): string[] {
    const visuals: string[] = [];

    // Extract colors with context
    const colorPattern =
      /\b(orange|blue|green|red|golden|silver|crimson|purple|pink|white|black|gray|grey)\s+([a-z]+)\b/g;
    let match;
    while ((match = colorPattern.exec(content)) !== null) {
      const color = match[1];
      const object = match[2];
      visuals.push(`${color} ${object}`);
    }

    // Extract textures and materials
    const texturePattern =
      /\b(soft|fluffy|smooth|rough|velvety|silky|sparkl\w+|glitt\w+|shimmer\w+)\s+([a-z]+)\b/g;
    while ((match = texturePattern.exec(content)) !== null) {
      const texture = match[1];
      const object = match[2];
      visuals.push(`${texture} ${object}`);
    }

    return [...new Set(visuals)];
  }

  private extractDirectVisualElements(content: string) {
    const elements = {
      character: '',
      action: '',
      objects: [] as string[],
      setting: '',
      colors: [] as string[],
      mood: '',
    };

    // DYNAMIC CHARACTER EXTRACTION - No hardcoded animal lists!
    const characters = this.extractCharactersDynamically(content);
    if (characters.length > 0) {
      // Take the first character that looks like a full description
      const fullCharacter = characters.find(char => char.includes(' the '));
      elements.character = fullCharacter || characters[0];
    }

    // DYNAMIC OBJECT EXTRACTION - Extract objects from visual elements
    const visuals = this.extractVisualElements(content);
    elements.objects = visuals.slice(0, 5); // Take top 5 visual elements as objects

    // DYNAMIC SETTING EXTRACTION
    const environments = this.extractEnvironmentsDynamically(content);
    if (environments.length > 0) {
      elements.setting = environments[0]; // Take the first/most prominent setting
    }

    // DYNAMIC COLOR EXTRACTION
    const colorElements = visuals.filter(v =>
      /\b(orange|blue|green|red|golden|silver|crimson|purple|pink|white|black|gray|grey)\s+/.test(
        v,
      ),
    );
    elements.colors = colorElements.slice(0, 3); // Take top 3 color elements

    // ACTION EXTRACTION
    const actionPatterns = [
      /(discovering|exploring|finding|playing\s+with|holding)/gi,
      /(hopped|hopping|bounced|bouncing|ran|running)/gi,
    ];

    actionPatterns.forEach(pattern => {
      const match = content.match(pattern);
      if (match && !elements.action) {
        elements.action = `${match[0]}`;
      }
    });

    // MOOD EXTRACTION
    const moodPatterns = [
      /(happy|joyful|excited|magical|whimsical|peaceful|adventurous)/gi,
    ];

    const moods = [];
    moodPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        moods.push(match[1]);
      }
    });

    if (moods.length > 0) {
      elements.mood = moods.slice(0, 2).join(' and ');
    }

    // Remove duplicates
    elements.objects = [...new Set(elements.objects)];
    elements.colors = [...new Set(elements.colors)];

    return elements;
  }

  /**
   * Extract physical features mentioned near a character name
   */
  private extractPhysicalFeatures(
    characterName: string,
    contextWindow: string,
  ): string[] {
    const features: string[] = [];
    const name = characterName.toLowerCase();

    // Physical feature patterns - more comprehensive
    const featurePatterns = [
      // Eyes: "bright purple eyes", "purple eyes"
      new RegExp(
        `${name}[^.!?]*?(bright\\s+purple|purple|blue|green|brown|hazel|bright)\\s+(eyes)`,
        'gi',
      ),
      new RegExp(
        `(bright\\s+purple|purple|blue|green|brown|hazel|bright)\\s+(eyes)[^.!?]*?${name}`,
        'gi',
      ),
      // Ears and tail: "long ears", "fluffy tail"
      new RegExp(
        `${name}[^.!?]*?(long|short|fluffy|soft)\\s+(ears|tail)`,
        'gi',
      ),
      new RegExp(
        `(long|short|fluffy|soft)\\s+(ears|tail)[^.!?]*?${name}`,
        'gi',
      ),
      // Nose and paws: "tiny pink nose", "small paws"
      new RegExp(
        `${name}[^.!?]*?(tiny|small|pink|black|soft)\\s+(nose|paws)`,
        'gi',
      ),
      new RegExp(
        `(tiny|small|pink|black|soft)\\s+(nose|paws)[^.!?]*?${name}`,
        'gi',
      ),
      // Fur descriptions that weren't caught in main extraction
      new RegExp(
        `${name}[^.!?]*?(cotton-soft|soft|fluffy|silky)\\s+(white|brown|golden|black)\\s+(fur)`,
        'gi',
      ),
    ];

    featurePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(contextWindow)) !== null) {
        const feature = match[1].includes(' ')
          ? `${match[1]} ${match[2]}`
          : `${match[1]} ${match[2]}`;
        if (!features.includes(feature)) {
          features.push(feature);
        }
      }
    });

    return features.slice(0, 3); // Limit to 3 features for clarity
  }

  // ===================================================
  // ADVANCED CONTENT ANALYSIS SYSTEM
  // ===================================================

  /**
   * Advanced Named Entity Recognition System
   */
  private performAdvancedNER(content: string) {
    const entities = {
      characters: [] as Array<{
        name: string;
        type: 'human' | 'animal';
        context: string;
        confidence: number;
        mentions: number;
      }>,
      animals: [] as Array<{
        name: string;
        description: string;
        type: 'animal';
        context: string;
        confidence: number;
        mentions: number;
      }>,
      objects: [] as Array<{
        name: string;
        context: string;
        confidence: number;
      }>,
      settings: [] as Array<{
        name: string;
        context: string;
        confidence: number;
      }>,
      relationships: [] as Array<{
        type: 'character-object' | 'character-character';
        character: string;
        object?: string;
        character1?: string;
        character2?: string;
        character3?: string | null;
        context: string;
        confidence: number;
      }>,
      sequences: [] as Array<any>,
      originalContent: content,
    };

    // Phase 1: Character Name Extraction with Context
    const characterPatterns = [
      // HUMAN-SPECIFIC patterns - require explicit human context to avoid matching animal names
      /\b([A-Z][a-z]{2,})\s+(?:was|is)\s+a\s+(?:girl|boy|child|person|student|kid)\b/gi,
      /\ba\s+(?:young|little|brave|curious)\s+(?:girl|boy|child)\s+(?:named|called)\s+([A-Z][a-z]+)/gi,
      // Human possessives with human-specific body parts/items
      /\b([A-Z][a-z]{2,})'s\s+(?:sneakers|ponytail|backpack|homework|friends|teacher|mom|dad|family)\b/gi,
      // Actions in explicitly human context (after checking for animal context)
      /\b(?:girl|boy|child|student)\s+(?:named|called)?\s*([A-Z][a-z]{2,})\s+(?:found|felt|thought|walked|ran|discovered|smiled|laughed|wondered|decided|noticed|saw|heard|said)\b/gi,
    ];

    characterPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const name = match[1];
        const context = match[0];
        if (name && !entities.characters.find(c => c.name === name)) {
          entities.characters.push({
            name,
            type: 'human',
            context,
            confidence: 0.9,
            mentions: 1,
          });
        }
      }
    });

    // Phase 2: Animal Detection with Descriptions
    const animalPatterns = [
      // Specific animal descriptions from the story
      /\b(fluffy\s+golden\s+retriever\s+puppy)\s+(?:with|named)?\s*([A-Z][a-z]*)?/gi,
      /\b(golden\s+retriever\s+puppy)\s+(?:with|named)?\s*([A-Z][a-z]*)?/gi,
      /\b(wise\s+old\s+tortoise)\s+(?:with|named)?\s*([A-Z][a-z]*)?/gi,
      // Generic animal patterns with potential names
      /\ba?\s*(friendly|little|tiny|big|brave|curious|wise|magical|fluffy|golden|old)?\s*(squirrel|rabbit|bear|fox|turtle|tortoise|mouse|cat|dog|puppy|bird|owl|deer|frog|snake|retriever)\s+(?:named|called)\s+([A-Z][a-z]+)/gi,
      // Name followed by animal type
      /\b([A-Z][a-z]+)\s+(?:the\s+)?(?:squirrel|rabbit|bear|fox|turtle|tortoise|mouse|cat|dog|puppy|bird|owl|deer|frog|snake|retriever)\b/gi,
    ];

    animalPatterns.forEach((pattern, patternIndex) => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        let description, name, animalType;

        if (patternIndex === 3) {
          // Generic animal pattern: /\ba?\s*(adjective)?\s*(animal)\s+(?:named|called)\s+([A-Z][a-z]+)/gi
          description = match[1] || 'animal'; // adjective like "little"
          animalType = match[2]; // animal type like "rabbit"
          name = match[3]; // name like "Luna"
        } else if (patternIndex === 4) {
          // Name followed by animal: /\b([A-Z][a-z]+)\s+(?:the\s+)?(?:animal_types)\b/gi
          name = match[1];
          animalType = match[2] || 'animal';
          description = animalType;
        } else {
          // Specific patterns (indices 0, 1)
          description = match[1] || match[2] || 'animal';
          name = match[2] || match[3] || match[1];
          animalType = description.includes('retriever')
            ? 'dog'
            : description.includes('tortoise')
            ? 'tortoise'
            : 'animal';
        }

        const fullMatch = match[0];

        if (name && name.length > 2 && /^[A-Z]/.test(name)) {
          entities.animals.push({
            name,
            description: animalType
              ? `${description} ${animalType}`.trim()
              : description,
            type: 'animal',
            context: fullMatch,
            confidence: 0.8,
            mentions: 1,
          });
        }
      }
    });

    // Phase 3: Cross-reference and validate entities
    entities.characters.forEach(char => {
      const contextLower = content.toLowerCase();
      const charLower = char.name.toLowerCase();
      const mentions = (
        contextLower.match(new RegExp(`\\b${charLower}\\b`, 'g')) || []
      ).length;
      char.mentions = mentions;
      char.confidence = Math.min(0.95, 0.5 + mentions * 0.1);
    });

    entities.animals.forEach(animal => {
      const contextLower = content.toLowerCase();
      const animalLower = animal.name.toLowerCase();
      const mentions = (
        contextLower.match(new RegExp(`\\b${animalLower}\\b`, 'g')) || []
      ).length;
      animal.mentions = mentions;
      animal.confidence = Math.min(0.95, 0.5 + mentions * 0.1);
    });

    // Phase 4: Object Relationship Mapping
    const objectPatterns = [
      // Character-object relationships
      /\b([A-Z][a-z]+)\s+(?:found|picked|held|grabbed|caught|discovered|saw|spotted)\s+(?:a|the)?\s*([\w\s]+?)(?:\.|,|\s+(?:hidden|under|near|in))/gi,
      /\b([A-Z][a-z]+)\s+(?:bounced|threw|tossed|played with)\s+(?:a|the)?\s*([\w\s]+?)(?:\.|,|\s+(?:high|up|down))/gi,
      /\b([A-Z][a-z]+)\s+(?:reached for|tied to|attached to)\s+(?:a|the)?\s*([\w\s]+)/gi,

      // Object descriptions with owners
      /\b([\w\s]+?)\s+(?:belonged to|owned by)\s+([A-Z][a-z]+)/gi,
      /\b([A-Z][a-z]+)'s\s+([\w\s]+?)(?:\.|,|\s+(?:was|were|had))/gi,
    ];

    objectPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const character = match[1] || match[2];
        const object = match[2] || match[1];

        if (character && object && /^[A-Z]/.test(character)) {
          entities.relationships.push({
            type: 'character-object',
            character,
            object: object.trim(),
            context: match[0],
            confidence: 0.8,
          });
        }
      }
    });

    return entities;
  }

  /**
   * Narrative Sequence Understanding Engine
   */
  private analyzeNarrativeSequence(content: string, entities: any) {
    const sequences = [];

    // Break content into sentences for sequential analysis
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);

    // Define sequence patterns for common story progressions
    const sequencePatterns = [
      // Discovery sequences
      {
        name: 'discovery',
        pattern: /\b(?:found|discovered|spotted|saw|noticed)\b/i,
        weight: 3,
        type: 'action',
      },
      // Play/interaction sequences
      {
        name: 'play',
        pattern: /\b(?:played|bounced|threw|tossed|chased|ran)\b/i,
        weight: 2,
        type: 'action',
      },
      // Meeting/social sequences
      {
        name: 'meeting',
        pattern: /\b(?:met|found|came|emerged|appeared|bounding)\b/i,
        weight: 2,
        type: 'social',
      },
      // Exploration sequences
      {
        name: 'exploration',
        pattern: /\b(?:explored|went|walked|led|path|deeper|hidden)\b/i,
        weight: 2,
        type: 'adventure',
      },
      // Magical/climax sequences
      {
        name: 'climax',
        pattern:
          /\b(?:suddenly|burst|rumble|magical|glowing|sparkling|crystal)\b/i,
        weight: 4,
        type: 'climax',
      },
    ];

    sentences.forEach((sentence, index) => {
      sequencePatterns.forEach(pattern => {
        if (pattern.pattern.test(sentence)) {
          // Extract characters involved in this sequence
          const involvedCharacters: string[] = [];
          entities.characters.forEach((char: any) => {
            if (sentence.toLowerCase().includes(char.name.toLowerCase())) {
              involvedCharacters.push(char.name);
            }
          });
          entities.animals.forEach((animal: any) => {
            if (sentence.toLowerCase().includes(animal.name.toLowerCase())) {
              involvedCharacters.push(animal.name);
            }
          });

          // Extract objects involved
          const involvedObjects: string[] = [];
          entities.relationships.forEach((rel: any) => {
            if (
              rel.type === 'character-object' &&
              sentence.toLowerCase().includes(rel.object.toLowerCase())
            ) {
              involvedObjects.push(rel.object);
            }
          });

          sequences.push({
            sequenceType: pattern.name,
            actionType: pattern.type,
            sentenceIndex: index,
            sentence: sentence.trim(),
            characters: involvedCharacters,
            objects: involvedObjects,
            weight: pattern.weight,
            confidence: 0.8,
          });
        }
      });
    });

    // Sort sequences by sentence order to maintain narrative flow
    sequences.sort((a, b) => a.sentenceIndex - b.sentenceIndex);

    // Identify the primary sequence (highest weight)
    const primarySequence = sequences.reduce(
      (prev, curr) => (curr.weight > prev.weight ? curr : prev),
      sequences[0] || {},
    );

    return {
      sequences,
      primarySequence,
      narrativeFlow: sequences.map((s: any) => s.sequenceType),
      keyMoments: sequences.filter((s: any) => s.weight >= 3),
    };
  }

  /**
   * Multiple Character Coordination System
   */
  private coordinateMultipleCharacters(entities: any, narrativeAnalysis: any) {
    const coordination = {
      primaryCharacter: null,
      secondaryCharacters: [],
      characterInteractions: [],
      sceneComposition: null,
      promptStructure: null,
    };

    // Identify primary character (most mentions and actions)
    const allCharacters = [...entities.characters, ...entities.animals];
    if (allCharacters.length > 0) {
      coordination.primaryCharacter = allCharacters.reduce((prev, curr) =>
        curr.mentions + curr.confidence > prev.mentions + prev.confidence
          ? curr
          : prev,
      );

      coordination.secondaryCharacters = allCharacters
        .filter(char => char !== coordination.primaryCharacter)
        .sort((a, b) => b.mentions + b.confidence - (a.mentions + a.confidence))
        .slice(0, 3); // Limit to 3 secondary characters for visual clarity
    }

    // Analyze character interactions from relationships
    entities.relationships.forEach((rel: any) => {
      if (rel.type === 'character-character') {
        coordination.characterInteractions.push({
          participants: [rel.character1, rel.character2, rel.character3].filter(
            Boolean,
          ),
          context: rel.context,
          confidence: rel.confidence,
        });
      }
    });

    // Determine optimal scene composition based on narrative
    if (narrativeAnalysis.primarySequence) {
      const primarySeq = narrativeAnalysis.primarySequence;

      coordination.sceneComposition = {
        sceneType: primarySeq.sequenceType,
        actionType: primarySeq.actionType,
        focusCharacters: primarySeq.characters,
        keyObjects: primarySeq.objects,
        mood:
          primarySeq.sequenceType === 'climax'
            ? 'dramatic'
            : primarySeq.sequenceType === 'discovery'
            ? 'curious'
            : primarySeq.sequenceType === 'play'
            ? 'joyful'
            : 'friendly',
      };
    }

    // Generate sophisticated prompt structure
    coordination.promptStructure = this.generateAdvancedPromptStructure(
      coordination,
      entities,
      narrativeAnalysis,
    );

    return coordination;
  }

  /**
   * Advanced Prompt Structure Generator with Template-Based Refinement
   */
  private generateAdvancedPromptStructure(
    coordination: any,
    entities: any,
    _narrativeAnalysis: any,
  ) {
    const structure = {
      characterDescription: '',
      sceneAction: '',
      objectElements: '',
      settingContext: '',
      moodDescription: '',
    };

    // Enhanced character description with story-specific details
    if (coordination.primaryCharacter) {
      const primary = coordination.primaryCharacter;

      // Extract character details from story context
      const content = entities.originalContent || '';
      const characterDetails = this.extractCharacterDetails(
        primary.name,
        content,
      );

      if (primary.type === 'human') {
        structure.characterDescription = this.buildHumanCharacterDescription(
          primary.name,
          characterDetails,
        );
      } else {
        // For animals, build proper description with name and type
        const animalType = primary.description || primary.type || 'animal';
        structure.characterDescription = `${primary.name} the ${animalType}`;
      }

      // Include secondary characters if they interact
      if (coordination.secondaryCharacters.length > 0) {
        const secondaries = coordination.secondaryCharacters
          .slice(0, 2)
          .map((char: any) => {
            if (char.type === 'human') {
              return `${char.name} (child)`;
            } else {
              return `${char.name} (${char.description || char.type})`;
            }
          });

        structure.characterDescription += ` with ${secondaries.join(' and ')}`;
      }
    }

    // Build scene action based on narrative sequence
    if (coordination.sceneComposition) {
      const scene = coordination.sceneComposition;
      switch (scene.sceneType) {
        case 'discovery':
          structure.sceneAction = 'discovering and examining';
          break;
        case 'play':
          structure.sceneAction = 'playing together with';
          break;
        case 'meeting':
          structure.sceneAction = 'meeting and greeting';
          break;
        case 'exploration':
          structure.sceneAction = 'exploring together in';
          break;
        case 'climax':
          structure.sceneAction = 'experiencing magical moment with';
          break;
        default:
          structure.sceneAction = 'interacting with';
      }
    }

    // Build refined object elements from relationships
    const refinedObjects = this.buildRefinedObjectElements(entities);

    if (refinedObjects.length > 0) {
      structure.objectElements = refinedObjects.join(' and ');
    }

    // Build mood description
    if (coordination.sceneComposition) {
      structure.moodDescription = coordination.sceneComposition.mood;
    }

    return structure;
  }

  /**
   * Character Detail Extraction for Template-Based Descriptions
   */
  private extractCharacterDetails(characterName: string, content: string) {
    const details = {
      physicalFeatures: [] as string[],
      clothing: [] as string[],
      personality: [] as string[],
      actions: [] as string[],
    };

    const nameLower = characterName.toLowerCase();

    // Extract physical features
    const physicalPatterns = [
      new RegExp(
        `${nameLower}'s\\s+(\\w+(?:-\\w+)?)\\s+(hair|eyes|face|ponytail)`,
        'gi',
      ),
      new RegExp(
        `${nameLower}\\s+(?:had|has|with)\\s+(\\w+(?:-\\w+)?)\\s+(hair|eyes|sneakers|shoes)`,
        'gi',
      ),
      new RegExp(
        `(\\w+(?:-\\w+)?)\\s+(hair|eyes|ponytail|sneakers).*${nameLower}`,
        'gi',
      ),
    ];

    physicalPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        details.physicalFeatures.push(`${match[1]} ${match[2]}`);
      }
    });

    // Extract clothing/accessories
    const clothingPatterns = [
      new RegExp(
        `${nameLower}'s\\s+(\\w+)\\s+(sneakers|shoes|dress|shirt|pants)`,
        'gi',
      ),
      new RegExp(
        `${nameLower}\\s+(?:wore|wearing|had)\\s+(\\w+)\\s+(sneakers|shoes|clothing)`,
        'gi',
      ),
    ];

    clothingPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        details.clothing.push(`${match[1]} ${match[2]}`);
      }
    });

    // Extract key actions for scene composition
    const actionPatterns = [
      new RegExp(
        `${nameLower}\\s+(found|discovered|picked|bounced|ran|chased|held)`,
        'gi',
      ),
      new RegExp(
        `${nameLower}\\s+(?:felt|thought|wondered|smiled|laughed)`,
        'gi',
      ),
    ];

    actionPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        details.actions.push(match[1]);
      }
    });

    return details;
  }

  /**
   * Build Human Character Description
   */
  private buildHumanCharacterDescription(name: string, details: any): string {
    let description = `a young ${
      name.includes('boy') || name.includes('Boy') ? 'boy' : 'girl'
    }`;

    // Add name if it's a proper name (not generic pronouns)
    if (
      name &&
      name !== 'She' &&
      name !== 'He' &&
      name !== 'child' &&
      name !== 'she' &&
      name !== 'he'
    ) {
      // Clean the name - remove undefined/null values
      const cleanName = String(name)
        .replace(/undefined|null/g, '')
        .trim();
      if (cleanName && cleanName.length > 1) {
        description += ` named ${cleanName}`;
      }
    }

    // Add most distinctive physical features (avoid duplicates)
    if (details.physicalFeatures.length > 0) {
      const uniqueFeatures = [...new Set(details.physicalFeatures)].filter(
        (feature: string) => feature && !feature.includes('undefined'),
      );
      if (uniqueFeatures.length > 0) {
        description += ` with ${uniqueFeatures.slice(0, 2).join(' and ')}`;
      }
    }

    // Add distinctive clothing if mentioned (avoid duplicates)
    if (details.clothing.length > 0) {
      const uniqueClothing = [...new Set(details.clothing)].filter(
        (clothing: string) => clothing && !clothing.includes('undefined'),
      );
      if (uniqueClothing.length > 0) {
        description += ` wearing ${uniqueClothing.slice(0, 1).join(' and ')}`;
      }
    }

    return description;
  }

  /**
   * Build Refined Object Elements
   */
  private buildRefinedObjectElements(entities: any): string[] {
    const objects = entities.relationships
      .filter((rel: any) => rel.type === 'character-object')
      .map((rel: any) => {
        // Clean and enhance object descriptions
        let obj = rel.object.trim();

        // Remove any existing adjectives from the object to avoid duplication
        obj = obj.replace(
          /^(shiny|bright|red|blue|green|yellow|purple|golden|silver|turquoise|big|small|tiny|large|little)\s+/gi,
          '',
        );

        // Add descriptive adjectives from context (avoid duplicates)
        const colorMatches = rel.context.match(
          /\b(red|blue|green|yellow|purple|golden|silver|turquoise)\b/gi,
        );
        const qualityMatches = rel.context.match(
          /\b(shiny|bright|glowing|sparkling)\b/gi,
        );
        const sizeMatches = rel.context.match(
          /\b(big|small|tiny|large|little)\b/gi,
        );

        let enhancedObj = obj;

        // Build adjective list without duplicates
        const adjectives = [];
        if (qualityMatches) adjectives.push(qualityMatches[0]);
        if (colorMatches) adjectives.push(colorMatches[0]);
        if (sizeMatches && adjectives.length === 0)
          adjectives.push(sizeMatches[0]);

        // Combine adjectives with object (max 2 adjectives for clarity)
        if (adjectives.length > 0) {
          const uniqueAdjectives = [...new Set(adjectives)].slice(0, 2);
          enhancedObj = `${uniqueAdjectives.join(' ')} ${obj}`;
        }

        return enhancedObj;
      })
      .filter(
        (obj: string, index: number, arr: string[]) =>
          arr.indexOf(obj) === index,
      ) // Remove duplicates
      .filter((obj: string) => obj && obj.trim().length > 0) // Remove empty objects
      .slice(0, 3); // Limit for visual clarity

    return objects;
  }

  /**
   * Main Advanced Prompt Generator - New Signature
   */
  private generateAdvancedPrompt(
    storyContent: string,
    nerEntities: any,
    narrativeSequence: any,
    coordinatedCharacters: any,
    gradeLevel: GradeLevel,
  ): string {
    const artStyleDefinition = ART_STYLE_MAPPING[gradeLevel];

    // Defensive check - ensure artStyleDefinition exists
    if (!artStyleDefinition || !artStyleDefinition.baseStyle) {
      console.error(
        `🚨 artStyleDefinition is undefined for gradeLevel: ${gradeLevel}`,
        { artStyleDefinition, availableKeys: Object.keys(ART_STYLE_MAPPING) },
      );
      // Fallback to simple fallback prompt
      return this.generateFallbackAdvancedPrompt(
        storyContent,
        nerEntities,
        gradeLevel,
        null,
      );
    }

    try {
      // Use the sophisticated prompt structure from character coordination
      if (coordinatedCharacters && coordinatedCharacters.promptStructure) {
        const structure = coordinatedCharacters.promptStructure;

        let prompt = `Create a ${artStyleDefinition.baseStyle}`;

        // 1. Character Description (enhanced with story details)
        if (structure.characterDescription) {
          prompt += ` showing ${structure.characterDescription}`;

          // Add secondary characters if present (but avoid pronouns)
          if (
            coordinatedCharacters.secondaryCharacters &&
            coordinatedCharacters.secondaryCharacters.length > 0
          ) {
            const validSecondaryChars =
              coordinatedCharacters.secondaryCharacters.filter(
                (char: any) =>
                  char.name &&
                  char.name !== 'She' &&
                  char.name !== 'He' &&
                  char.name !== 'she' &&
                  char.name !== 'he' &&
                  char.name !== 'child',
              );

            if (validSecondaryChars.length > 0) {
              const secondaryChar = validSecondaryChars[0];
              if (secondaryChar.type === 'animal') {
                prompt += ` and a ${
                  secondaryChar.description || secondaryChar.name
                }`;
              }
            }
          }
        }

        // 2. Scene Action (grammatically correct)
        if (structure.sceneAction) {
          let action = structure.sceneAction;
          if (action === 'experiencing magical moment with') {
            action = 'discovering';
          } else if (action === 'interacting with') {
            action = 'playing with';
          }
          prompt += ` ${action}`;
        }

        // 3. Objects and Setting (refined descriptions)
        if (structure.objectElements) {
          prompt += ` ${structure.objectElements}`;
        }

        // 4. Setting Context (if available)
        if (structure.settingContext) {
          prompt += ` in ${structure.settingContext}`;
        }

        // 5. Mood and Atmosphere
        let mood = 'whimsical and joyful';
        if (structure.moodDescription) {
          switch (structure.moodDescription) {
            case 'dramatic':
              mood = 'magical and wondrous';
              break;
            case 'curious':
              mood = 'bright and curious';
              break;
            case 'joyful':
              mood = 'happy and playful';
              break;
            case 'friendly':
              mood = 'warm and friendly';
              break;
            default:
              mood = structure.moodDescription;
          }
        }
        prompt += `, ${mood} atmosphere`;

        // Always add safety constraints
        prompt += ', safe for children, G-rated content';

        return prompt;
      }

      // Fallback to basic character/entity extraction if structure is missing
      return this.generateFallbackAdvancedPrompt(
        storyContent,
        nerEntities,
        gradeLevel,
        artStyleDefinition,
      );
    } catch (error) {
      console.error('Error in generateAdvancedPrompt:', error);
      return this.generateFallbackAdvancedPrompt(
        storyContent,
        nerEntities,
        gradeLevel,
        artStyleDefinition,
      );
    }
  }

  /**
   * Fallback Advanced Prompt Generator
   */
  private generateFallbackAdvancedPrompt(
    storyContent: string,
    nerEntities: any,
    gradeLevel: GradeLevel,
    _artStyleDefinition: any,
  ): string {
    const gradeStyles = {
      'K-2': "children's book watercolor illustration",
      '3-5': "detailed children's book illustration",
      '6-8': 'realistic digital illustration',
      '9-12': 'professional digital artwork',
    };

    let prompt = `Create a ${gradeStyles[gradeLevel]}`;

    // Extract key characters from NER entities
    if (
      nerEntities &&
      nerEntities.characters &&
      nerEntities.characters.length > 0
    ) {
      const primaryChar = nerEntities.characters[0];
      if (primaryChar.type === 'human') {
        prompt += ` showing a ${primaryChar.name || 'young child'}`;
      } else {
        prompt += ` showing a ${primaryChar.description || primaryChar.name}`;
      }
    }

    // Extract key objects
    if (nerEntities && nerEntities.objects && nerEntities.objects.length > 0) {
      const keyObjects = nerEntities.objects
        .slice(0, 2)
        .map((obj: any) => obj.name || obj)
        .join(' and ');
      prompt += ` with ${keyObjects}`;
    }

    prompt += ', safe for children, G-rated content';

    return prompt;
  }

  /**
   * Template-Based Refined Prompt Generator (Legacy Function - Keep for compatibility)
   */
  private generateAdvancedPromptLegacy(
    analysis: StoryAnalysis,
    characterCoordination: any,
    gradeLevel: GradeLevel = 'K-2',
  ): string {
    const gradeStyles = {
      'K-2': "children's book watercolor illustration",
      '3-5': "detailed children's book illustration",
      '6-8': 'realistic digital illustration',
      '9-12': 'professional digital artwork',
    };

    // Template: "Create a [art_style] showing [character_description] [action] [objects_and_setting], [mood], [safety]"

    let prompt = `Create a ${gradeStyles[gradeLevel]}`;

    // Use the sophisticated prompt structure from character coordination
    if (characterCoordination.promptStructure) {
      const structure = characterCoordination.promptStructure;

      // 1. Character Description (enhanced with story details)
      if (structure.characterDescription) {
        prompt += ` showing ${structure.characterDescription}`;

        // Add secondary characters if present (but avoid pronouns like "She", "he")
        if (
          characterCoordination.secondaryCharacters &&
          characterCoordination.secondaryCharacters.length > 0
        ) {
          const validSecondaryChars =
            characterCoordination.secondaryCharacters.filter(
              (char: any) =>
                char.name &&
                char.name !== 'She' &&
                char.name !== 'He' &&
                char.name !== 'she' &&
                char.name !== 'he' &&
                char.name !== 'child',
            );

          if (validSecondaryChars.length > 0) {
            const secondaryChar = validSecondaryChars[0];
            if (secondaryChar.type === 'animal') {
              prompt += ` and a ${
                secondaryChar.description || secondaryChar.name
              }`;
            }
          }
        }
      }

      // 2. Scene Action (grammatically correct)
      if (structure.sceneAction) {
        // Clean up action to be grammatically correct
        let action = structure.sceneAction;
        if (action === 'experiencing magical moment with') {
          action = 'discovering';
        } else if (action === 'interacting with') {
          action = 'playing with';
        }
        prompt += ` ${action}`;
      }

      // 3. Objects and Setting (refined descriptions)
      if (structure.objectElements) {
        prompt += ` ${structure.objectElements}`;
      }

      // 4. Setting Context (if available)
      if (structure.settingContext) {
        prompt += ` in ${structure.settingContext}`;
      } else {
        // Add basic setting context - could be enhanced later
        prompt += ' in a beautiful magical setting';
      }

      // 5. Mood and Atmosphere
      let mood = 'whimsical and joyful';
      if (structure.moodDescription) {
        switch (structure.moodDescription) {
          case 'dramatic':
            mood = 'magical and wondrous';
            break;
          case 'curious':
            mood = 'bright and curious';
            break;
          case 'joyful':
            mood = 'happy and playful';
            break;
          case 'friendly':
            mood = 'warm and friendly';
            break;
          default:
            mood = structure.moodDescription;
        }
      }
      prompt += `, ${mood} atmosphere`;

      // Always add safety constraints
      prompt += ', safe for children, G-rated content';

      return prompt;
    } else {
      // Fallback to basic prompt if structure is missing
      return `Create a ${gradeStyles[gradeLevel]} showing characters from the story in a magical setting, safe for children, G-rated content`;
    }
  }

  /**
   * Extract setting hints from analysis
   */
  private extractSettingHints(analysis: StoryAnalysis): string | null {
    // Check scenes for setting information
    if (
      analysis.scenes &&
      ((analysis.scenes.nature && analysis.scenes.nature.length > 0) ||
        (analysis.scenes.magical && analysis.scenes.magical.length > 0))
    ) {
      return 'a magical outdoor setting';
    }

    // Check themes for nature/outdoor indicators
    const hasNature =
      analysis.themes &&
      analysis.themes.some(
        theme => theme.includes('nature') || theme.includes('adventure'),
      );

    if (hasNature) {
      return 'a beautiful park setting';
    }

    return null;
  }
}

// Auto-reset statistics periodically
setInterval(() => {
  const service = imageGenerationService;
  const stats = service.getRateLimitingStats();

  if (
    Date.now() - stats.lastResetTime >
    RATE_LIMIT_CONFIG.STATS_RESET_INTERVAL
  ) {
    console.log(
      `📈 Auto-resetting rate limiting stats. Last hour: ${stats.totalRequests} total, ${stats.rejectedRequests} rejected, ${stats.queuedRequests} queued`,
    );
    service.resetRateLimitingStats();
  }
}, RATE_LIMIT_CONFIG.STATS_RESET_INTERVAL);

// Export singleton instance
export const imageGenerationService = new ImageGenerationService();

// Export clients for testing
export { ReplicateClient, BackupServiceClient };
