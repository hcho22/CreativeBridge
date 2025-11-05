#!/usr/bin/env node

/**
 * Enhanced Content Analysis with Image Generation and Download Script
 *
 * This script takes a full story, analyzes it with the enhanced content analysis system,
 * creates a single optimized prompt, generates an actual image using the AI API,
 * and automatically downloads and saves the image to the generated-images directory.
 *
 * Features:
 * - Advanced story content analysis (characters, themes, emotional tone)
 * - Grade-level appropriate prompt generation (K-2, 3-5, 6-8, 9-12)
 * - AI image generation via Replicate API
 * - Automatic image download and local storage
 * - Descriptive filename generation with timestamps
 *
 * Usage:
 *   node scripts/test-enhanced-content-analysis.js
 *   node scripts/test-enhanced-content-analysis.js --story="Your custom story here"
 *   node scripts/test-enhanced-content-analysis.js --file="path/to/story.txt" --grade=6-8
 *   node scripts/test-enhanced-content-analysis.js --file="story.md" --grade=3-5
 *
 * Requirements:
 * - REPLICATE_API_TOKEN in .env file
 * - Generated images saved to: generated-images/
 */

const { config } = require('dotenv');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

// Load environment variables
config({ path: path.resolve(__dirname, '../.env') });

// Ensure images directory exists
const imagesDir = path.resolve(__dirname, '../generated-images');
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
  console.log(`📁 Created images directory: ${imagesDir}`);
}

// Parse command line arguments
const args = process.argv.slice(2);
const customStory = args.find(arg => arg.startsWith('--story='))?.split('=')[1];
const storyFile = args.find(arg => arg.startsWith('--file='))?.split('=')[1];
const gradeLevel =
  args.find(arg => arg.startsWith('--grade='))?.split('=')[1] || 'K-2';

console.log('🧠 Enhanced Content Analysis with Image Generation');
console.log('='.repeat(60));

// Function to read story from file
function readStoryFromFile(filePath) {
  try {
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(process.cwd(), filePath);

    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found: ${absolutePath}`);
    }

    const content = fs.readFileSync(absolutePath, 'utf8').trim();

    if (!content) {
      throw new Error(`File is empty: ${absolutePath}`);
    }

    console.log(`📖 Story loaded from file: ${path.basename(absolutePath)}`);
    return content;
  } catch (error) {
    console.error(`❌ Error reading story file: ${error.message}`);
    process.exit(1);
  }
}

// Determine story source (file, command line, or default)
let STORY_SOURCE = 'Featured Story';
let FEATURED_STORY;

if (storyFile) {
  FEATURED_STORY = readStoryFromFile(storyFile);
  STORY_SOURCE = `File: ${path.basename(storyFile)}`;
} else if (customStory) {
  FEATURED_STORY = customStory;
  STORY_SOURCE = 'Command Line';
} else {
  FEATURED_STORY = `A friendly squirrel named Sparkle wearing a bright green vest stands proudly next to her new friend Hazel, a curious young girl with braided hair. Together they explore a magical forest filled with ancient oak trees whose branches seem to whisper secrets. In Sparkle's tiny paws, she holds a glowing map that shows hidden treasures scattered throughout the enchanted woodland. A worn teddy bear named Mr. Buttons sits peacefully on a moss-covered log nearby, his button eyes twinkling with wisdom from countless adventures. Sparkly golden lights dance around them like fireflies, creating a warm and magical atmosphere as the two friends plan their next great adventure together.`;
}

// Backup test samples for comparison
const COMPARISON_SAMPLES = {
  narrative: `In a big, green forest, Tim the tiny turtle found a shiny, blue stone. He felt happy and wanted to show it to his best friend, Lily the ladybug. But when he turned around, he saw that Lily was gone! A friendly squirrel with a bushy tail as fluffy as a cloud suddenly popped out from behind a tree stump, holding the sparkling blue stone in his tiny paws and chattering excitedly, "I caught it! My name is Nutty, and I love catching things that roll!"`,

  inspirational: `Here's to the crazy ones. The misfits. The rebels. The troublemakers. The round pegs in the square holes. The ones who see things differently. They're not fond of rules. And they have no respect for the status quo. You can praise them, disagree with them, quote them, disbelieve them, glorify or vilify them. About the only thing you can't do is ignore them. Because they change things. They invent. They imagine. They heal. They explore. They create. They inspire. They push the human race forward.`,
};

// Enhanced content analysis with improved character and narrative detection
function analyzeEnhancedContent(content) {
  console.log(`\n📊 Enhanced Content Analysis:`);
  console.log('-'.repeat(50));

  const contentTypeResult = detectContentTypeAdvanced(content);
  const concepts = extractConceptsAdvanced(content);
  const themes = analyzeSemanticThemesAdvanced(content, concepts);
  const visualConcepts = generateVisualConceptsAdvanced(
    contentTypeResult.type,
    concepts,
    themes,
  );
  const emotionalTone = analyzeEmotionalToneAdvanced(content, concepts);
  const narrativeElements = analyzeNarrativeElementsAdvanced(content);

  const analysis = {
    contentType: contentTypeResult,
    concepts,
    themes,
    visualConcepts,
    emotionalTone,
    narrativeElements,
  };

  return analysis;
}

function detectContentTypeAdvanced(content) {
  const text = content.toLowerCase();
  const scores = {
    narrative: 0,
    inspirational: 0,
    philosophical: 0,
    abstract: 0,
    poetic: 0,
  };
  const reasoning = [];

  // Enhanced narrative detection with comprehensive character recognition
  const characterPatterns = [
    // Human characters (names that appear with human context)
    /\b([A-Z][a-z]{2,})\s+(?:felt|thought|walked|ran|found|discovered|smiled|laughed|wondered|decided|noticed|saw|heard|said)\b/gi,
    /\b([A-Z][a-z]{2,})'s\s+(?:heart|eyes|face|hands|hair|voice|mind|thoughts)\b/gi,
    /\b([A-Z][a-z]{2,})\s+(?:was|is)\s+a\s+(?:girl|boy|child|person|student|kid)\b/gi,
    
    // Named animals with broader patterns
    /\b([A-Z][a-z]+)\s+(?:the\s+)?(?:squirrel|rabbit|bear|fox|turtle|tortoise|mouse|cat|dog|puppy|bird|owl|deer|frog|snake|retriever|poodle|beagle|collie)\b/gi,
    /\b(?:squirrel|rabbit|bear|fox|turtle|tortoise|mouse|cat|dog|puppy|bird|owl|deer|frog|snake|retriever|poodle|beagle|collie)\s+named\s+([A-Z][a-z]+)/gi,
    
    // Descriptive animals with broader coverage
    /\b(?:friendly|little|tiny|big|brave|curious|wise|magical|fluffy|golden|old)\s+(?:squirrel|rabbit|bear|fox|turtle|tortoise|mouse|cat|dog|puppy|bird|owl|deer|frog|snake|retriever)\b/gi,
    
    // Animals with detailed descriptions
    /\b(?:golden\s+retriever|fluffy.*?(?:puppy|dog)|wise.*?(?:tortoise|turtle|owl)|little.*?(?:mouse|rabbit))\b/gi,
  ];

  let characterScore = 0;
  characterPatterns.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) {
      characterScore += matches.length * 3;
      reasoning.push(`Found character: "${matches[0]}"`);
    }
  });
  scores.narrative += characterScore;

  // Story structure indicators
  const narrativePatterns = [
    /\b(once upon a time|story|tale|adventure)\b/gi,
    /\b(stands?|sits?|looks?|walks?|runs?|finds?|discovers?)\b/gi,
    /\b(friend|together|nearby|around)\b/gi,
    /\b(magical|enchanted|mysterious|special)\s+(forest|garden|place|world)\b/gi,
  ];

  narrativePatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      scores.narrative += matches.length * 2;
      reasoning.push(`Found narrative element: "${matches[0]}"`);
    }
  });

  // Other content type detection (simplified for focus)
  if (/\b(inspire|create|change|dream|crazy|rebel|different)\b/g.test(text)) {
    scores.inspirational += 4;
    reasoning.push('Found inspirational content');
  }

  if (/\b(consciousness|existence|meaning|question|what\s+is)\b/g.test(text)) {
    scores.philosophical += 4;
    reasoning.push('Found philosophical content');
  }

  if (/\b(imagine|space|realm|essence|consciousness)\b/g.test(text)) {
    scores.abstract += 3;
    reasoning.push('Found abstract content');
  }

  const maxScore = Math.max(...Object.values(scores));
  const primaryType =
    Object.entries(scores).find(([_, score]) => score === maxScore)?.[0] ||
    'abstract';
  const totalScore = Object.values(scores).reduce(
    (sum, score) => sum + score,
    0,
  );
  const confidence =
    totalScore > 0 ? Math.min((maxScore / totalScore) * 100, 95) : 50;

  console.log(
    `🎯 Content Type: ${primaryType} (${Math.round(confidence)}% confidence)`,
  );
  if (characterScore > 0) {
    console.log(
      `   👥 Character Score: ${characterScore} (strong character presence)`,
    );
  }
  if (reasoning.length > 0) {
    console.log(`   🔍 Detection: ${reasoning[0]}`);
  }

  return {
    type: primaryType,
    confidence: Math.round(confidence),
    reasoning,
    characterScore,
  };
}

// Advanced Named Entity Recognition System
function performAdvancedNER(content) {
  const entities = {
    characters: [],
    animals: [],
    objects: [],
    settings: [],
    relationships: [],
    sequences: []
  };

  // Phase 1: Character Name Extraction with Context
  const characterPatterns = [
    // Direct name mentions with context
    /\b([A-Z][a-z]{2,})\s+(?:found|felt|thought|walked|ran|discovered|smiled|laughed|wondered|decided|noticed|saw|heard|said|bounced|picked|held|grabbed|reached)\b/gi,
    /\b([A-Z][a-z]{2,})'s\s+(?:heart|eyes|face|hands|hair|voice|mind|thoughts|sneakers|ponytail|head|body)\b/gi,
    /\b([A-Z][a-z]{2,})\s+(?:was|is)\s+a\s+(?:girl|boy|child|person|student|kid)\b/gi,
    // Character introductions
    /\ba\s+(?:young|little|brave|curious)\s+(?:girl|boy|child)\s+(?:named|called)\s+([A-Z][a-z]+)/gi,
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
          mentions: 1
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

  animalPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const description = match[1] || match[2] || 'animal';
      const name = match[2] || match[3] || match[1];
      const fullMatch = match[0];
      
      if (name && name.length > 2 && /^[A-Z]/.test(name)) {
        entities.animals.push({
          name,
          description,
          type: 'animal',
          context: fullMatch,
          confidence: 0.8,
          mentions: 1
        });
      }
    }
  });

  // Phase 3: Cross-reference and validate entities
  entities.characters.forEach(char => {
    const contextLower = content.toLowerCase();
    const charLower = char.name.toLowerCase();
    const mentions = (contextLower.match(new RegExp(`\\b${charLower}\\b`, 'g')) || []).length;
    char.mentions = mentions;
    char.confidence = Math.min(0.95, 0.5 + (mentions * 0.1));
  });

  entities.animals.forEach(animal => {
    const contextLower = content.toLowerCase();
    const animalLower = animal.name.toLowerCase();
    const mentions = (contextLower.match(new RegExp(`\\b${animalLower}\\b`, 'g')) || []).length;
    animal.mentions = mentions;
    animal.confidence = Math.min(0.95, 0.5 + (mentions * 0.1));
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
          confidence: 0.8
        });
      }
    }
  });

  // Phase 5: Character-Character Relationships
  const characterRelationPatterns = [
    /\b([A-Z][a-z]+)\s+(?:and|with)\s+([A-Z][a-z]+)\s+(?:played|explored|went|walked|ran)/gi,
    /\b([A-Z][a-z]+),?\s+([A-Z][a-z]+),?\s+and\s+([A-Z][a-z]+)/gi,
    /\b([A-Z][a-z]+)\s+(?:met|found|saw)\s+([A-Z][a-z]+)/gi,
  ];

  characterRelationPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const char1 = match[1];
      const char2 = match[2];
      const char3 = match[3];
      
      if (char1 && char2) {
        entities.relationships.push({
          type: 'character-character',
          character1: char1,
          character2: char2,
          character3: char3 || null,
          context: match[0],
          confidence: 0.7
        });
      }
    }
  });

  // Store original content for later use
  entities.originalContent = content;
  
  return entities;
}

// Narrative Sequence Understanding Engine
function analyzeNarrativeSequence(content, entities) {
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
      type: 'action'
    },
    // Play/interaction sequences
    {
      name: 'play',
      pattern: /\b(?:played|bounced|threw|tossed|chased|ran)\b/i,
      weight: 2,
      type: 'action'
    },
    // Meeting/social sequences
    {
      name: 'meeting',
      pattern: /\b(?:met|found|came|emerged|appeared|bounding)\b/i,
      weight: 2,
      type: 'social'
    },
    // Exploration sequences
    {
      name: 'exploration',
      pattern: /\b(?:explored|went|walked|led|path|deeper|hidden)\b/i,
      weight: 2,
      type: 'adventure'
    },
    // Magical/climax sequences
    {
      name: 'climax',
      pattern: /\b(?:suddenly|burst|rumble|magical|glowing|sparkling|crystal)\b/i,
      weight: 4,
      type: 'climax'
    }
  ];
  
  sentences.forEach((sentence, index) => {
    sequencePatterns.forEach(pattern => {
      if (pattern.pattern.test(sentence)) {
        // Extract characters involved in this sequence
        const involvedCharacters = [];
        entities.characters.forEach(char => {
          if (sentence.toLowerCase().includes(char.name.toLowerCase())) {
            involvedCharacters.push(char.name);
          }
        });
        entities.animals.forEach(animal => {
          if (sentence.toLowerCase().includes(animal.name.toLowerCase())) {
            involvedCharacters.push(animal.name);
          }
        });
        
        // Extract objects involved
        const involvedObjects = [];
        entities.relationships.forEach(rel => {
          if (rel.type === 'character-object' && sentence.toLowerCase().includes(rel.object.toLowerCase())) {
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
          confidence: 0.8
        });
      }
    });
  });
  
  // Sort sequences by sentence order to maintain narrative flow
  sequences.sort((a, b) => a.sentenceIndex - b.sentenceIndex);
  
  // Identify the primary sequence (highest weight)
  const primarySequence = sequences.reduce((prev, curr) => 
    curr.weight > prev.weight ? curr : prev, sequences[0] || {});
  
  return {
    sequences,
    primarySequence,
    narrativeFlow: sequences.map(s => s.sequenceType),
    keyMoments: sequences.filter(s => s.weight >= 3)
  };
}

// Multiple Character Coordination System
function coordinateMultipleCharacters(entities, narrativeAnalysis) {
  const coordination = {
    primaryCharacter: null,
    secondaryCharacters: [],
    characterInteractions: [],
    sceneComposition: null,
    promptStructure: null
  };
  
  // Identify primary character (most mentions and actions)
  const allCharacters = [...entities.characters, ...entities.animals];
  if (allCharacters.length > 0) {
    coordination.primaryCharacter = allCharacters.reduce((prev, curr) => 
      (curr.mentions + curr.confidence) > (prev.mentions + prev.confidence) ? curr : prev
    );
    
    coordination.secondaryCharacters = allCharacters
      .filter(char => char !== coordination.primaryCharacter)
      .sort((a, b) => (b.mentions + b.confidence) - (a.mentions + a.confidence))
      .slice(0, 3); // Limit to 3 secondary characters for visual clarity
  }
  
  // Analyze character interactions from relationships
  entities.relationships.forEach(rel => {
    if (rel.type === 'character-character') {
      coordination.characterInteractions.push({
        participants: [rel.character1, rel.character2, rel.character3].filter(Boolean),
        context: rel.context,
        confidence: rel.confidence
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
      mood: primarySeq.sequenceType === 'climax' ? 'dramatic' : 
             primarySeq.sequenceType === 'discovery' ? 'curious' :
             primarySeq.sequenceType === 'play' ? 'joyful' : 'friendly'
    };
  }
  
  // Generate sophisticated prompt structure
  coordination.promptStructure = generateAdvancedPromptStructure(coordination, entities, narrativeAnalysis);
  
  return coordination;
}

// Advanced Prompt Structure Generator with Template-Based Refinement
function generateAdvancedPromptStructure(coordination, entities, narrativeAnalysis) {
  const structure = {
    characterDescription: '',
    sceneAction: '',
    objectElements: '',
    settingContext: '',
    moodDescription: ''
  };
  
  // Enhanced character description with story-specific details
  if (coordination.primaryCharacter) {
    const primary = coordination.primaryCharacter;
    
    // Extract character details from story context (add originalContent to entities if not present)
    const content = entities.originalContent || narrativeAnalysis.originalContent || '';
    const characterDetails = extractCharacterDetails(primary.name, content);
    
    if (primary.type === 'human') {
      structure.characterDescription = buildHumanCharacterDescription(primary.name, characterDetails);
    } else {
      structure.characterDescription += ` (${primary.description || 'an animal friend'})`;
    }
    
    // Include secondary characters if they interact
    if (coordination.secondaryCharacters.length > 0) {
      const secondaries = coordination.secondaryCharacters.slice(0, 2).map(char => {
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
  const refinedObjects = buildRefinedObjectElements(entities);
  
  if (refinedObjects.length > 0) {
    structure.objectElements = refinedObjects.join(' and ');
  }
  
  // Build mood description
  if (coordination.sceneComposition) {
    structure.moodDescription = coordination.sceneComposition.mood;
  }
  
  return structure;
}

// Character Detail Extraction for Template-Based Descriptions
function extractCharacterDetails(characterName, content) {
  const details = {
    physicalFeatures: [],
    clothing: [],
    personality: [],
    actions: []
  };
  
  const nameLower = characterName.toLowerCase();
  
  // Extract physical features
  const physicalPatterns = [
    new RegExp(`${nameLower}'s\\s+(\\w+(?:-\\w+)?)\\s+(hair|eyes|face|ponytail)`, 'gi'),
    new RegExp(`${nameLower}\\s+(?:had|has|with)\\s+(\\w+(?:-\\w+)?)\\s+(hair|eyes|sneakers|shoes)`, 'gi'),
    new RegExp(`(\\w+(?:-\\w+)?)\\s+(hair|eyes|ponytail|sneakers).*${nameLower}`, 'gi')
  ];
  
  physicalPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      details.physicalFeatures.push(`${match[1]} ${match[2]}`);
    }
  });
  
  // Extract clothing/accessories
  const clothingPatterns = [
    new RegExp(`${nameLower}'s\\s+(\\w+)\\s+(sneakers|shoes|dress|shirt|pants)`, 'gi'),
    new RegExp(`${nameLower}\\s+(?:wore|wearing|had)\\s+(\\w+)\\s+(sneakers|shoes|clothing)`, 'gi')
  ];
  
  clothingPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      details.clothing.push(`${match[1]} ${match[2]}`);
    }
  });
  
  // Extract key actions for scene composition
  const actionPatterns = [
    new RegExp(`${nameLower}\\s+(found|discovered|picked|bounced|ran|chased|held)`, 'gi'),
    new RegExp(`${nameLower}\\s+(?:felt|thought|wondered|smiled|laughed)`, 'gi')
  ];
  
  actionPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      details.actions.push(match[1]);
    }
  });
  
  return details;
}

function buildHumanCharacterDescription(name, details) {
  let description = `a young ${name.includes('boy') || name.includes('Boy') ? 'boy' : 'girl'}`;
  
  // Add name if it's a proper name (not generic pronouns)
  if (name && name !== 'She' && name !== 'He' && name !== 'child' && name !== 'she' && name !== 'he') {
    // Clean the name - remove undefined/null values
    const cleanName = String(name).replace(/undefined|null/g, '').trim();
    if (cleanName && cleanName.length > 1) {
      description += ` named ${cleanName}`;
    }
  }
  
  // Add most distinctive physical features (avoid duplicates)
  if (details.physicalFeatures.length > 0) {
    const uniqueFeatures = [...new Set(details.physicalFeatures)]
      .filter(feature => feature && !feature.includes('undefined'));
    if (uniqueFeatures.length > 0) {
      description += ` with ${uniqueFeatures.slice(0, 2).join(' and ')}`;
    }
  }
  
  // Add distinctive clothing if mentioned (avoid duplicates)
  if (details.clothing.length > 0) {
    const uniqueClothing = [...new Set(details.clothing)]
      .filter(clothing => clothing && !clothing.includes('undefined'));
    if (uniqueClothing.length > 0) {
      description += ` wearing ${uniqueClothing.slice(0, 1).join(' and ')}`;
    }
  }
  
  return description;
}

function buildRefinedObjectElements(entities) {
  const objects = entities.relationships
    .filter(rel => rel.type === 'character-object')
    .map(rel => {
      // Clean and enhance object descriptions
      let obj = rel.object.trim();
      
      // Remove any existing adjectives from the object to avoid duplication
      obj = obj.replace(/^(shiny|bright|red|blue|green|yellow|purple|golden|silver|turquoise|big|small|tiny|large|little)\s+/gi, '');
      
      // Add descriptive adjectives from context (avoid duplicates)
      const colorMatches = rel.context.match(/\b(red|blue|green|yellow|purple|golden|silver|turquoise)\b/gi);
      const qualityMatches = rel.context.match(/\b(shiny|bright|glowing|sparkling)\b/gi);
      const sizeMatches = rel.context.match(/\b(big|small|tiny|large|little)\b/gi);
      
      let enhancedObj = obj;
      
      // Build adjective list without duplicates
      const adjectives = [];
      if (qualityMatches) adjectives.push(qualityMatches[0]);
      if (colorMatches) adjectives.push(colorMatches[0]);
      if (sizeMatches && adjectives.length === 0) adjectives.push(sizeMatches[0]);
      
      // Combine adjectives with object (max 2 adjectives for clarity)
      if (adjectives.length > 0) {
        const uniqueAdjectives = [...new Set(adjectives)].slice(0, 2);
        enhancedObj = `${uniqueAdjectives.join(' ')} ${obj}`;
      }
      
      return enhancedObj;
    })
    .filter((obj, index, arr) => arr.indexOf(obj) === index) // Remove duplicates
    .filter(obj => obj && obj.trim().length > 0) // Remove empty objects
    .slice(0, 3); // Limit for visual clarity
    
  return objects;
}

// Extract detailed visual elements from story content
function extractDetailedVisualElements(content) {
  const visualElements = {
    characters: [],
    clothing: [],
    objects: [],
    settings: [],
    colors: [],
    materials: [],
    actions: [],
  };

  // Character descriptions with precise extraction
  const characterPatterns = [
    // Specific character names (highest priority)
    /\b(Mia)\b/gi,
    /\b(Buddy)\b/gi, 
    /\b(Theodore)\b/gi,
    
    // Specific animal descriptions from the story
    /\b(fluffy\s+golden\s+retriever\s+puppy)\b/gi,
    /\b(golden\s+retriever\s+puppy)\b/gi,
    /\b(wise\s+old\s+tortoise)\b/gi,
    
    // Human character references
    /\ba\s+(girl|boy|child)\s+(?:with|named)\s+([A-Z][a-z]+)/gi,
    /\b([A-Z][a-z]{3,})\s+(?:felt|thought|walked|ran|found|discovered|smiled|laughed)\b/gi,
    
    // Generic character types as fallback
    /\b(young\s+girl|little\s+girl|young\s+boy|little\s+boy)\b/gi,
  ];

  characterPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      visualElements.characters.push({
        name: match[3] || match[1],
        type: match[2],
        description: match[1],
        fullMatch: match[0],
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
        item: match[2] || match[1],
        description: match[1] || match[2],
        detail: match[0],
      });
    }
  });

  // Objects and artifacts with comprehensive detection
  const objectPatterns = [
    // Specific colored objects (critical for story accuracy)
    /\b(shiny\s+red\s+ball|red\s+ball|crimson\s+ball)\b/gi,
    /\b(turquoise\s+ribbon|sparkling\s+turquoise\s+ribbon)\b/gi,
    /\b(bright\s+red\s+ball|smooth\s+round\s+ball)\b/gi,
    
    // Story-specific items
    /\b(note|letter)\s+(?:tied\s+to|attached\s+to|on\s+the)\s+([\w\s]+)/gi,
    /\b(hidden\s+trapdoor|trapdoor)\s+(?:burst\s+open|opened|appeared)/gi,
    /\b(crystal\s+staircase|glowing\s+crystals?\s+staircase|underground\s+staircase)\b/gi,
    /\b(magnificent\s+oak\s+tree|oak\s+tree)\s+with\s+([\w\s-]+)/gi,
    
    // Traditional story objects
    /\b(\w+\s+\w+)\s+(map|key|book|stone|crystal|gem|treasure|portal|door|gate)\b/gi,
    /\b(map|key|book|stone|crystal|gem|treasure|portal|door|gate)\s+(?:made\s+of\s+|adorned\s+with\s+)?(\w+\s+\w+)/gi,
    /\b(teddy\s+bear)\s+with\s+(\w+\s+\w+\s*\w*)/gi,
    
    // Clothing and accessories 
    /\b(purple\s+sneakers|honey-brown\s+ponytail|[\w-]+\s+(?:sneakers|shoes|ponytail|hair))\b/gi,
  ];

  objectPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      visualElements.objects.push({
        item: match[2] || match[1],
        description: match[1] || match[2],
        detail: match[0],
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
        location: match[2] || match[1],
        description: match[1] || match[2],
        detail: match[0],
      });
    }
  });

  // Colors and materials
  const colorMaterialPatterns = [
    /\b(emerald|golden|silver|crystal|mahogany|silk|velvet|leather|gossamer|iridescent)\s+(\w+)/gi,
    /\b(bright|dark|deep|pale|vibrant|shimmering|sparkling|glowing)\s+(\w+\s+\w+|\w+)/gi,
  ];

  colorMaterialPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      if (
        match[1].match(
          /emerald|golden|silver|crystal|mahogany|silk|velvet|leather|gossamer|iridescent/,
        )
      ) {
        visualElements.materials.push({
          material: match[1],
          item: match[2],
          detail: match[0],
        });
      } else {
        visualElements.colors.push({
          color: match[1],
          item: match[2],
          detail: match[0],
        });
      }
    }
  });

  return visualElements;
}

function extractConceptsAdvanced(content) {
  const concepts = [];
  const text = content.toLowerCase();

  // PHASE 1: Advanced Named Entity Recognition
  const nerEntities = performAdvancedNER(content);
  
  // PHASE 2: Narrative Sequence Analysis
  const narrativeAnalysis = analyzeNarrativeSequence(content, nerEntities);
  
  // PHASE 3: Character Coordination
  const characterCoordination = coordinateMultipleCharacters(nerEntities, narrativeAnalysis);

  // First extract detailed visual elements
  const visualElements = extractDetailedVisualElements(content);

  const conceptPatterns = {
    characters: {
      animals: [
        'squirrel',
        'rabbit',
        'bear',
        'fox',
        'turtle',
        'mouse',
        'cat',
        'dog',
        'bird',
        'owl',
      ],
      people: [
        'friend',
        'child',
        'person',
        'boy',
        'girl',
        'princess',
        'prince',
        'wizard',
        'fairy',
      ],
      fantasy: [
        'dragon',
        'unicorn',
        'fairy',
        'elf',
        'giant',
        'witch',
        'wizard',
      ],
    },
    emotions: {
      positive: [
        'happy',
        'joyful',
        'excited',
        'peaceful',
        'curious',
        'wonder',
        'awe',
        'friendly',
      ],
      magical: [
        'mysterious',
        'enchanted',
        'magical',
        'mystical',
        'sparkling',
        'glowing',
      ],
    },
    objects: {
      story: [
        'map',
        'treasure',
        'key',
        'book',
        'letter',
        'stone',
        'crystal',
        'gem',
      ],
      nature: [
        'forest',
        'tree',
        'flower',
        'garden',
        'river',
        'mountain',
        'path',
        'bridge',
      ],
      magical: ['wand', 'spell', 'potion', 'magic', 'light', 'sparkle', 'glow'],
    },
  };

  // PRIORITY 1: Add NER entities as highest-priority concepts
  nerEntities.characters.forEach(char => {
    concepts.push({
      concept: char.name,
      category: 'characters',
      subCategory: 'ner-human',
      weight: 8.0 + char.confidence,
      visualDetail: char.context,
      occurrences: char.mentions,
      nerData: char
    });
  });

  nerEntities.animals.forEach(animal => {
    concepts.push({
      concept: `${animal.name} (${animal.description})`,
      category: 'characters', 
      subCategory: 'ner-animal',
      weight: 7.0 + animal.confidence,
      visualDetail: animal.context,
      occurrences: animal.mentions,
      nerData: animal
    });
  });

  // PRIORITY 2: Add object relationships
  nerEntities.relationships.forEach(rel => {
    if (rel.type === 'character-object') {
      concepts.push({
        concept: `${rel.character} with ${rel.object}`,
        category: 'relationships',
        subCategory: 'character-object',
        weight: 6.0 + rel.confidence,
        visualDetail: rel.context,
        occurrences: 1,
        relationshipData: rel
      });
    }
  });

  // Add detailed visual elements as high-priority concepts
  visualElements.characters.forEach(char => {
    concepts.push({
      concept: `${char.description} ${char.type} ${char.name}`,
      category: 'characters',
      subCategory: 'detailed',
      weight: 5.0,
      visualDetail: char.fullMatch,
      occurrences: 1,
    });
  });

  visualElements.clothing.forEach(item => {
    concepts.push({
      concept: item.detail,
      category: 'clothing',
      subCategory: 'detailed',
      weight: 4.0,
      visualDetail: item.detail,
      occurrences: 1,
    });
  });

  visualElements.objects.forEach(obj => {
    concepts.push({
      concept: obj.detail,
      category: 'objects',
      subCategory: 'detailed',
      weight: 4.0,
      visualDetail: obj.detail,
      occurrences: 1,
    });
  });

  visualElements.settings.forEach(setting => {
    concepts.push({
      concept: setting.detail,
      category: 'settings',
      subCategory: 'detailed',
      weight: 4.0,
      visualDetail: setting.detail,
      occurrences: 1,
    });
  });

  visualElements.materials.forEach(material => {
    concepts.push({
      concept: material.detail,
      category: 'materials',
      subCategory: 'detailed',
      weight: 3.5,
      visualDetail: material.detail,
      occurrences: 1,
    });
  });

  visualElements.colors.forEach(color => {
    concepts.push({
      concept: color.detail,
      category: 'colors',
      subCategory: 'detailed',
      weight: 3.0,
      visualDetail: color.detail,
      occurrences: 1,
    });
  });

  // Extract traditional named characters with enhanced patterns
  const namedCharacters = [];
  const characterNamePatterns = [
    // Human names (appearing with action verbs)
    /\b([A-Z][a-z]{2,})\s+(?:felt|thought|walked|ran|found|discovered|smiled|laughed|wondered|decided|noticed|saw|heard|said|bounced|picked|held)\b/gi,
    /\b([A-Z][a-z]{2,})'s\s+(?:heart|eyes|face|hands|hair|voice|mind|thoughts|sneakers|ponytail)\b/gi,
    
    // Named animals with broader patterns
    /\b([A-Z][a-z]+)\s+(?:the\s+)?(?:squirrel|rabbit|bear|fox|turtle|tortoise|mouse|cat|dog|puppy|bird|owl|retriever)\b/gi,
    /\b(?:squirrel|rabbit|bear|fox|turtle|tortoise|mouse|cat|dog|puppy|bird|owl|retriever)\s+named\s+([A-Z][a-z]+)/gi,
    /\b(?:fluffy\s+golden\s+retriever\s+puppy)\s+(?:named\s+)?([A-Z][a-z]+)/gi,
    /\b(?:wise\s+old\s+tortoise)\s+(?:named\s+)?([A-Z][a-z]+)/gi,
  ];

  characterNamePatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const name = match[1];
      namedCharacters.push(name);
      // Only add if not already captured in detailed visual elements
      const alreadyCaptured = concepts.some(c => c.concept.includes(name));
      if (!alreadyCaptured) {
        concepts.push({
          concept: name,
          category: 'characters',
          subCategory: 'named',
          weight: 3.0,
          occurrences: 1,
        });
      }
    }
  });

  // Extract other concepts
  Object.entries(conceptPatterns).forEach(([mainCategory, subCategories]) => {
    Object.entries(subCategories).forEach(([subCategory, patterns]) => {
      patterns.forEach(pattern => {
        const regex = new RegExp(`\\b${pattern}\\w*\\b`, 'gi');
        const matches = text.match(regex);
        if (matches) {
          const weight =
            matches.length +
            (text.indexOf(pattern) < text.length * 0.3 ? 0.5 : 0);
          concepts.push({
            concept: pattern,
            category: mainCategory,
            subCategory,
            weight,
            occurrences: matches.length,
          });
        }
      });
    });
  });

  const sortedConcepts = concepts.sort((a, b) => b.weight - a.weight);
  console.log(`🧩 Key Concepts Found (${sortedConcepts.length} total):`);

  // Show detailed visual elements first
  const detailedConcepts = sortedConcepts.filter(
    c => c.subCategory === 'detailed',
  );
  const otherConcepts = sortedConcepts.filter(
    c => c.subCategory !== 'detailed',
  );

  console.log(`   📝 Detailed Visual Elements (${detailedConcepts.length}):`);
  detailedConcepts.slice(0, 4).forEach(concept => {
    console.log(
      `   • ${concept.concept} (${
        concept.category
      }, weight: ${concept.weight.toFixed(1)})`,
    );
  });

  console.log(`   🔍 Other Concepts (${otherConcepts.length}):`);
  otherConcepts.slice(0, 4).forEach(concept => {
    console.log(
      `   • ${concept.concept} (${concept.category}/${
        concept.subCategory || ''
      }, weight: ${concept.weight.toFixed(1)})`,
    );
  });

  return {
    detailed: detailedConcepts,
    general: otherConcepts,
    all: sortedConcepts,
    // Advanced analysis data
    nerEntities,
    narrativeAnalysis,
    characterCoordination,
  };
}

function analyzeSemanticThemesAdvanced(content, conceptsData) {
  const concepts = conceptsData.all || conceptsData;
  const themes = [];
  const text = content.toLowerCase();

  const themeGroups = {
    innovation: [
      'create',
      'invent',
      'new',
      'imagine',
      'innovation',
      'original',
    ],
    rebellion: [
      'rebel',
      'different',
      'change',
      'challenge',
      'unconventional',
      'misfits',
    ],
    growth: ['grow', 'develop', 'progress', 'evolve', 'transform', 'forward'],
    beauty: [
      'beautiful',
      'beauty',
      'aesthetic',
      'elegant',
      'graceful',
      'lovely',
    ],
    wisdom: [
      'wise',
      'wisdom',
      'knowledge',
      'understanding',
      'insight',
      'enlightenment',
    ],
    nature: ['forest', 'tree', 'garden', 'flower', 'wind', 'earth', 'natural'],
    friendship: ['friend', 'together', 'helps', 'shares', 'plays', 'companion'],
    adventure: [
      'adventure',
      'journey',
      'explores',
      'discovers',
      'quest',
      'map',
      'treasure',
    ],
    magic: [
      'magic',
      'magical',
      'enchanted',
      'mystical',
      'glowing',
      'sparkle',
      'fairy',
      'wizard',
    ],
  };

  Object.entries(themeGroups).forEach(([themeName, keywords]) => {
    const foundKeywords = keywords.filter(keyword => text.includes(keyword));
    const conceptBonus = concepts
      .filter(c => keywords.some(kw => c.concept.includes(kw)))
      .reduce((sum, c) => sum + c.weight, 0);

    if (foundKeywords.length > 0 || conceptBonus > 0) {
      const baseStrength = (foundKeywords.length / keywords.length) * 100;
      const strength = Math.min(baseStrength + conceptBonus * 10, 100);

      themes.push({
        theme: themeName,
        strength,
        keywords: foundKeywords,
        conceptSupport: conceptBonus,
        visualMetaphors: getVisualMetaphors(themeName),
      });
    }
  });

  const sortedThemes = themes.sort((a, b) => b.strength - a.strength);
  console.log(
    `🎨 Semantic Themes:`,
    sortedThemes.map(t => `${t.theme} (${t.strength.toFixed(1)}%)`),
  );

  return sortedThemes;
}

function generateVisualConceptsAdvanced(contentType, conceptsData, themes) {
  const visualConcepts = [];

  // Prioritize detailed visual elements from story
  const detailedConcepts = conceptsData.detailed || [];
  const generalConcepts =
    conceptsData.general || conceptsData.all || conceptsData;

  // Add story-specific detailed elements (highest priority)
  detailedConcepts.forEach((concept, index) => {
    let elementText = concept.concept;

    // Clean up and format the concept for visual description
    if (concept.category === 'characters') {
      elementText = concept.concept.replace(/\b(named|the)\b/gi, '').trim();
    } else if (concept.category === 'clothing') {
      elementText = concept.concept
        .replace(/\b(adorned with|embroidered with|made of)\b/gi, 'featuring')
        .trim();
    }

    visualConcepts.push({
      element: elementText,
      type: `story-specific ${concept.category}`,
      weight: concept.weight + (10 - index), // Boost weight for story specifics
      source: 'detailed story analysis',
      isStorySpecific: true,
    });
  });

  // Add character-based elements from general concepts
  const characterConcepts = Array.isArray(generalConcepts)
    ? generalConcepts.filter(c => c.category === 'characters')
    : (generalConcepts.all || []).filter(c => c.category === 'characters');

  characterConcepts.slice(0, 2).forEach(concept => {
    if (!visualConcepts.some(v => v.element.includes(concept.concept))) {
      visualConcepts.push({
        element: `${concept.concept} character`,
        type: 'character element',
        weight: concept.weight,
        source: 'character analysis',
      });
    }
  });

  // Add theme-based visual elements (only if we need more elements)
  if (visualConcepts.length < 6) {
    themes.slice(0, 2).forEach(theme => {
      const metaphors = theme.visualMetaphors;
      if (metaphors) {
        metaphors.slice(0, 1).forEach(metaphor => {
          visualConcepts.push({
            element: metaphor,
            type: 'thematic element',
            weight: theme.strength / 100,
            source: theme.theme,
          });
        });
      }
    });
  }

  // Content-type specific fallbacks (only if we still need more)
  if (visualConcepts.length < 4) {
    const fallbacks = {
      narrative: ['storybook scene', 'character interaction'],
      inspirational: ['uplifting moment', 'breakthrough scene'],
      philosophical: ['contemplative scene', 'symbolic representation'],
      abstract: ['artistic interpretation', 'conceptual visualization'],
      poetic: ['lyrical scene', 'poetic visualization'],
    };

    const fallbackList = fallbacks[contentType.type] || fallbacks.narrative;
    fallbackList.forEach((fallback, index) => {
      visualConcepts.push({
        element: fallback,
        type: 'content fallback',
        weight: 1 + (fallbackList.length - index),
        source: `${contentType.type} content`,
      });
    });
  }

  const sortedVisuals = visualConcepts
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 8);

  console.log(`👁️ Visual Concepts (Story-Specific Priority):`);
  const storySpecific = sortedVisuals.filter(v => v.isStorySpecific);
  const other = sortedVisuals.filter(v => !v.isStorySpecific);

  console.log(
    `   🎨 Story Elements: ${storySpecific
      .slice(0, 3)
      .map(v => v.element)
      .join(', ')}`,
  );
  if (other.length > 0) {
    console.log(
      `   🌐 Supporting: ${other
        .slice(0, 2)
        .map(v => v.element)
        .join(', ')}`,
    );
  }

  return sortedVisuals;
}

function analyzeEmotionalToneAdvanced(content, conceptsData) {
  const concepts = conceptsData.all || conceptsData;
  const text = content.toLowerCase();

  const emotionalIndicators = {
    friendly: ['friendly', 'kind', 'gentle', 'warm', 'caring', 'helpful'],
    magical: [
      'magical',
      'enchanted',
      'mystical',
      'sparkling',
      'glowing',
      'wonder',
    ],
    adventurous: ['adventure', 'exciting', 'bold', 'brave', 'daring', 'quest'],
    peaceful: ['peaceful', 'calm', 'serene', 'quiet', 'gentle', 'soft'],
    joyful: [
      'happy',
      'joyful',
      'cheerful',
      'delighted',
      'excited',
      'celebrate',
    ],
    inspiring: [
      'inspire',
      'amazing',
      'wonderful',
      'brilliant',
      'extraordinary',
      'breakthrough',
    ],
    curious: [
      'curious',
      'wonder',
      'explore',
      'discover',
      'investigate',
      'question',
    ],
    contemplative: [
      'thoughtful',
      'reflective',
      'deep',
      'profound',
      'meditative',
    ],
  };

  let primaryTone = 'friendly';
  let maxScore = 0;
  let toneDetails = [];

  Object.entries(emotionalIndicators).forEach(([tone, indicators]) => {
    const score = indicators.reduce((sum, indicator) => {
      const count = (text.match(new RegExp(`\\b${indicator}\\b`, 'g')) || [])
        .length;
      if (count > 0) {
        toneDetails.push(`${indicator} (${count})`);
      }
      return sum + count;
    }, 0);

    if (score > maxScore) {
      maxScore = score;
      primaryTone = tone;
    }
  });

  // Consider concept-based emotions
  const emotionConcepts = concepts.filter(c => c.category === 'emotions');
  if (emotionConcepts.length > 0 && maxScore === 0) {
    primaryTone = emotionConcepts[0].concept;
    maxScore = emotionConcepts[0].weight;
  }

  const intensity = Math.min(maxScore / 3, 1);

  console.log(
    `💝 Emotional Tone: ${primaryTone} (intensity: ${(intensity * 100).toFixed(
      1,
    )}%)`,
  );

  return {
    primary: primaryTone,
    intensity,
    details: toneDetails.slice(0, 3),
    conceptSupport: emotionConcepts.length,
  };
}

function analyzeNarrativeElementsAdvanced(content) {
  const text = content.toLowerCase();

  // Enhanced character detection
  const characterPatterns = [
    /\b[A-Z][a-z]+\s+(?:the\s+)?(?:squirrel|rabbit|bear|fox|turtle|mouse|cat|dog|bird|owl)/gi,
    /\b(?:squirrel|rabbit|bear|fox|turtle|mouse|cat|dog|bird|owl)\s+named\s+[A-Z][a-z]+/gi,
    /\b(he|she|they|character|person|friend|child)\b/gi,
  ];

  let characterScore = 0;
  const foundCharacters = [];
  characterPatterns.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) {
      characterScore += matches.length;
      foundCharacters.push(...matches.slice(0, 3));
    }
  });

  const elements = {
    hasCharacters: characterScore > 0,
    characterScore,
    foundCharacters: foundCharacters.slice(0, 5),
    hasPlot:
      /\b(story|adventure|happened|found|went|did|stands|sits|looks)\b/g.test(
        text,
      ),
    hasSettings:
      /\b(forest|garden|castle|house|village|mountain|river|place|magical)\b/g.test(
        text,
      ),
    hasDialogue: /["'].*["']/g.test(content),
    timeframe: detectTimeframe(text),
    storyStructure: detectStoryStructure(content),
  };

  console.log(`📖 Narrative Elements:`, {
    characters: elements.characterScore,
    plot: elements.hasPlot,
    setting: elements.hasSettings,
    structure: elements.storyStructure,
  });

  return elements;
}

function detectStoryStructure(content) {
  const text = content.toLowerCase();

  if (/\b(once upon a time|long ago)\b/g.test(text)) return 'fairy tale';
  if (
    /\b(in the beginning|first)\b/g.test(text) &&
    /\b(finally|at last|the end)\b/g.test(text)
  )
    return 'linear narrative';
  if (/\b(suddenly|then|next|after that)\b/g.test(text)) return 'sequential';
  if (/\b(imagine|what if|suppose)\b/g.test(text)) return 'hypothetical';

  return 'descriptive';
}

function generateVisualSuggestions(contentType) {
  const suggestions = {
    narrative: {
      artStyle: 'story illustration',
      composition: 'scene-based layout',
      colorMood: 'warm and inviting',
    },
    inspirational: {
      artStyle: 'uplifting conceptual art',
      composition: 'ascending and expansive',
      colorMood: 'bright and energetic',
    },
    philosophical: {
      artStyle: 'contemplative surrealism',
      composition: 'balanced and thoughtful',
      colorMood: 'deep and contemplative',
    },
    abstract: {
      artStyle: 'pure abstraction',
      composition: 'flowing and organic',
      colorMood: 'expressive and bold',
    },
    poetic: {
      artStyle: 'lyrical visualization',
      composition: 'rhythmic and flowing',
      colorMood: 'soft and dreamy',
    },
  };

  const suggestion = suggestions[contentType] || suggestions.abstract;
  console.log(`🎨 Visual Suggestions:`, suggestion);

  return suggestion;
}

function generateEnhancedPrompt(analysis, gradeLevel = 'K-2') {
  console.log(`\n✨ Enhanced Prompt Generation for ${gradeLevel}:`);
  console.log('-'.repeat(40));

  const promptParts = [];

  // Grade-level base styles based on content type
  const baseStyles = {
    narrative: {
      'K-2': "children's book watercolor illustration",
      '3-5': "detailed children's book illustration",
      '6-8': 'realistic narrative illustration',
      '9-12': 'professional story artwork',
    },
    inspirational: {
      'K-2': "uplifting children's illustration",
      '3-5': 'motivational artwork for kids',
      '6-8': 'powerful conceptual illustration',
      '9-12': 'inspiring professional artwork',
    },
    philosophical: {
      'K-2': "thoughtful children's illustration",
      '3-5': 'contemplative artwork',
      '6-8': 'philosophical visual art',
      '9-12': 'profound conceptual artwork',
    },
    abstract: {
      'K-2': 'colorful abstract art for children',
      '3-5': 'expressive abstract illustration',
      '6-8': 'sophisticated abstract art',
      '9-12': 'contemporary abstract artwork',
    },
    poetic: {
      'K-2': 'whimsical poetry illustration',
      '3-5': 'artistic poetry visualization',
      '6-8': 'sophisticated poetic art',
      '9-12': 'elegant literary artwork',
    },
  };

  const styleMap =
    baseStyles[analysis.contentType.type] || baseStyles.narrative;
  const baseStyle = styleMap[gradeLevel] || styleMap['K-2'];
  promptParts.push(`Create a ${baseStyle}`);

  // Add story-specific visual elements with highest priority
  const storySpecificVisuals = analysis.visualConcepts.filter(
    v => v.isStorySpecific,
  );
  const characterVisuals = analysis.visualConcepts.filter(
    v => v.type.includes('character') && !v.isStorySpecific,
  );
  const otherVisuals = analysis.visualConcepts.filter(
    v => !v.type.includes('character') && !v.isStorySpecific,
  );

  // ADVANCED CHARACTER COORDINATION: Use NER and narrative analysis
  const coordination = analysis.concepts.characterCoordination;
  let characterPromptPart = '';
  let objectPromptPart = '';
  let actionPromptPart = '';

  if (coordination && coordination.promptStructure) {
    const structure = coordination.promptStructure;
    
    // Build character-focused prompt using advanced coordination
    if (structure.characterDescription) {
      characterPromptPart = `showing ${structure.characterDescription}`;
    }
    
    if (structure.sceneAction && structure.objectElements) {
      actionPromptPart = `${structure.sceneAction} ${structure.objectElements}`;
    } else if (structure.objectElements) {
      actionPromptPart = `with ${structure.objectElements}`;
    }
    
    // Combine advanced prompt parts
    const advancedPromptParts = [characterPromptPart, actionPromptPart].filter(Boolean);
    if (advancedPromptParts.length > 0) {
      promptParts.push(advancedPromptParts.join(' '));
    }
  } else {
    // Fallback to original visual concepts if advanced coordination fails
    const characterElements = analysis.visualConcepts.filter(v => 
      v.type.includes('character') || v.source === 'character analysis' || 
      v.element.match(/\b(?:Mia|Buddy|Theodore|girl|boy|child|puppy|retriever|tortoise)\b/i)
    );
    const objectElements = analysis.visualConcepts.filter(v => 
      v.type.includes('objects') || v.element.match(/\b(?:ball|ribbon|note|staircase|trapdoor)\b/i)
    );
    
    const topVisuals = [
      ...characterElements.slice(0, 2),
      ...objectElements.slice(0, 2)
    ].slice(0, 4);

    if (topVisuals.length > 0) {
      promptParts.push(`featuring ${topVisuals.map(v => v.element).join(' and ')}`);
    }
  }

  // Advanced prompt construction is now handled above

  // Add semantic themes
  const topThemes = analysis.themes.slice(0, 2);
  if (topThemes.length > 0) {
    promptParts.push(
      `exploring themes of ${topThemes.map(t => t.theme).join(' and ')}`,
    );
  }

  // Add emotional tone
  if (analysis.emotionalTone.primary !== 'neutral') {
    promptParts.push(`with a ${analysis.emotionalTone.primary} atmosphere`);
  }

  // Content-specific modifiers
  const modifiers = {
    narrative: 'with clear storytelling and character focus',
    inspirational: 'conveying breakthrough energy and transformation',
    abstract: 'with flowing, expressive cosmic elements',
    philosophical: 'encouraging contemplation and reflection',
    poetic: 'with lyrical, rhythmic visual elements',
  };

  const modifier = modifiers[analysis.contentType.type];
  if (modifier) {
    promptParts.push(modifier);
  }

  // Safety guidelines
  const safety = {
    'K-2': 'safe for very young children, bright and cheerful',
    '3-5': 'age-appropriate for children, positive',
    '6-8': 'suitable for middle school students, inspiring',
    '9-12': 'appropriate for young adults, sophisticated',
  };

  promptParts.push(safety[gradeLevel]);

  const finalPrompt = promptParts.join(', ');

  console.log(`📝 Enhanced Prompt:`);
  console.log(`"${finalPrompt}"`);
  console.log(`\n📏 Prompt Length: ${finalPrompt.length} characters`);

  return finalPrompt;
}

// Template-Based Refined Prompt Generator  
function generateAdvancedPrompt(analysis, characterCoordination, gradeLevel = 'K-2') {
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
      if (characterCoordination.secondaryCharacters && characterCoordination.secondaryCharacters.length > 0) {
        const validSecondaryChars = characterCoordination.secondaryCharacters.filter(char => 
          char.name && 
          char.name !== 'She' && 
          char.name !== 'He' && 
          char.name !== 'she' && 
          char.name !== 'he' &&
          char.name !== 'child'
        );
        
        if (validSecondaryChars.length > 0) {
          const secondaryChar = validSecondaryChars[0];
          if (secondaryChar.type === 'animal') {
            prompt += ` and a ${secondaryChar.description || secondaryChar.name}`;
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
      // Infer setting from story analysis
      const settingHints = extractSettingHints(analysis);
      if (settingHints) {
        prompt += ` in ${settingHints}`;
      }
    }
    
    // 5. Mood and Atmosphere
    let mood = 'whimsical and joyful';
    if (structure.moodDescription) {
      switch(structure.moodDescription) {
        case 'dramatic': mood = 'magical and wondrous'; break;
        case 'curious': mood = 'bright and curious'; break; 
        case 'joyful': mood = 'happy and playful'; break;
        case 'friendly': mood = 'warm and friendly'; break;
        default: mood = structure.moodDescription;
      }
    }
    prompt += `, ${mood} atmosphere`;
    
  } else {
    // Fallback to basic enhanced prompt
    prompt = generateEnhancedPrompt(analysis, gradeLevel);
  }
  
  // Always add safety constraints
  prompt += ', safe for children, G-rated content';
  
  console.log(`🚀 Refined Template-Based Prompt:`);
  console.log(`"${prompt}"`);
  console.log(`\n📏 Refined Prompt Length: ${prompt.length} characters`);
  
  return prompt;
}

// Extract setting hints from analysis
function extractSettingHints(analysis) {
  // Look for setting keywords in narrative elements or themes
  const settingKeywords = ['park', 'garden', 'forest', 'playground', 'yard', 'house', 'room', 'kitchen', 'bedroom'];
  
  if (analysis.narrativeElements && analysis.narrativeElements.setting) {
    return 'a magical outdoor setting';
  }
  
  // Check themes for nature/outdoor indicators
  const hasNature = analysis.themes && analysis.themes.some(theme => {
    const themeStr = typeof theme === 'string' ? theme : String(theme);
    return themeStr.includes('nature') || themeStr.includes('adventure');
  });
  
  if (hasNature) {
    return 'a beautiful park setting';
  }
  
  return null;
}

// Helper functions
function extractContext(content, concept) {
  const sentences = content.split(/[.!?]+/);
  return sentences
    .filter(sentence => sentence.toLowerCase().includes(concept.toLowerCase()))
    .map(s => s.trim());
}

function detectTimeframe(text) {
  if (/\b(was|were|had|once|ago)\b/g.test(text)) return 'past';
  if (/\b(will|shall|future|tomorrow)\b/g.test(text)) return 'future';
  if (/\b(is|are|now|currently)\b/g.test(text)) return 'present';
  return 'timeless';
}

function getVisualMetaphors(theme) {
  const metaphors = {
    innovation: ['lightbulb', 'gears', 'rocket', 'laboratory'],
    rebellion: ['breaking chains', 'lone wolf', 'rising phoenix'],
    growth: ['sprouting seed', 'growing tree', 'butterfly emerging'],
    beauty: ['blooming flower', 'sunset', 'crystalline form'],
    wisdom: ['ancient oak', 'wise owl', 'open book'],
    nature: ['flowing river', 'mountain vista', 'forest clearing'],
  };
  return metaphors[theme] || ['abstract symbol'];
}

// Download image from URL and save to local directory
async function downloadImage(imageUrl, filename) {
  return new Promise((resolve, reject) => {
    if (!imageUrl || imageUrl === 'No URL available') {
      reject(new Error('Invalid image URL provided'));
      return;
    }

    console.log(`\n💾 Downloading image from: ${imageUrl}`);

    const protocol = imageUrl.startsWith('https:') ? https : http;
    const filepath = path.join(imagesDir, filename);

    const file = fs.createWriteStream(filepath);

    const request = protocol.get(imageUrl, response => {
      if (response.statusCode !== 200) {
        reject(
          new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`),
        );
        return;
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        console.log(`✅ Image saved successfully: ${filepath}`);
        resolve(filepath);
      });
    });

    request.on('error', error => {
      fs.unlink(filepath, () => {}); // Delete partial file on error
      reject(error);
    });

    file.on('error', error => {
      fs.unlink(filepath, () => {}); // Delete partial file on error
      reject(error);
    });
  });
}

async function generateImage(prompt) {
  if (!process.env.REPLICATE_API_TOKEN) {
    console.log('\n⚠️ No REPLICATE_API_TOKEN found in .env file');
    console.log('💡 Add your API token to generate actual images');
    return null;
  }

  console.log('\n🚀 Starting Image Generation...');
  console.log('-'.repeat(40));

  try {
    // Start prediction
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: 'stability-ai/stable-diffusion-3.5-large',
        input: {
          prompt: prompt,
          width: 1024,
          height: 1024,
          num_inference_steps: 28,
          guidance_scale: 3.5,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const prediction = await response.json();
    console.log(`✅ Image generation started!`);
    console.log(`🆔 Prediction ID: ${prediction.id}`);
    console.log(`📊 Status: ${prediction.status}`);

    // Poll for completion
    console.log('\n⏳ Waiting for image generation to complete...');
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes maximum

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      attempts++;

      const statusResponse = await fetch(
        `https://api.replicate.com/v1/predictions/${prediction.id}`,
        {
          headers: {
            Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
          },
        },
      );

      const statusData = await statusResponse.json();

      if (statusData.status === 'succeeded') {
        console.log(`\n🎉 Image Generation Complete!`);
        // Debug: log the full response to understand structure
        console.log(
          `🔍 Debug - Full output:`,
          JSON.stringify(statusData.output, null, 2),
        );

        let imageUrl = null;
        if (statusData.output) {
          if (
            Array.isArray(statusData.output) &&
            statusData.output.length > 0
          ) {
            imageUrl = statusData.output[0];
          } else if (typeof statusData.output === 'string') {
            imageUrl = statusData.output;
          }
        }

        console.log(
          `📸 Generated Image URL: ${imageUrl || 'No URL available'}`,
        );
        console.log(`🔗 View Result: https://replicate.com/p/${prediction.id}`);
        console.log(`⏱️ Generation Time: ${attempts * 5} seconds`);
        return {
          success: true,
          imageUrl: imageUrl,
          predictionId: prediction.id,
          generationTime: attempts * 5,
        };
      } else if (statusData.status === 'failed') {
        console.log(`\n❌ Image generation failed: ${statusData.error}`);
        return { success: false, error: statusData.error };
      } else {
        process.stdout.write('.');
      }
    }

    console.log(`\n⏰ Timeout: Image generation took longer than 5 minutes`);
    console.log(
      `🔗 Check status manually: https://replicate.com/p/${prediction.id}`,
    );
    return { success: false, error: 'Timeout' };
  } catch (error) {
    console.log(`\n❌ Image generation failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runSingleStoryAnalysisAndGeneration() {
  console.log(`\n📚 Single Story Analysis and Image Generation`);
  console.log(`Story Source: ${STORY_SOURCE}`);
  console.log(`Grade Level: ${gradeLevel}`);

  const storyToAnalyze = FEATURED_STORY;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📖 Story Content (${storyToAnalyze.length} characters):`);
  console.log(`${'='.repeat(60)}`);
  console.log(
    `"${storyToAnalyze.substring(0, 200)}${
      storyToAnalyze.length > 200 ? '...' : ''
    }"`,
  );

  // Analyze content with enhanced system
  const analysis = analyzeEnhancedContent(storyToAnalyze);
  
  // NEW: Add advanced NER analysis
  console.log(`\n🚀 Running Advanced Analysis:`);
  const entities = performAdvancedNER(storyToAnalyze);
  const narrativeAnalysis = analyzeNarrativeSequence(storyToAnalyze, entities);  
  const characterCoordination = coordinateMultipleCharacters(entities, narrativeAnalysis);
  
  // Integrate advanced results into existing structure
  analysis.advancedEntities = entities;
  analysis.narrativeAnalysis = narrativeAnalysis;
  analysis.characterCoordination = characterCoordination;

  // Generate enhanced prompt using advanced character coordination
  const enhancedPrompt = generateAdvancedPrompt(analysis, characterCoordination, gradeLevel);

  // Compare with old broken system
  console.log('\n📊 System Comparison:');
  console.log('-'.repeat(40));

  const brokenMatches = storyToAnalyze.match(/(\w+)\s+the\s+(\w+)/gi) || [];
  const brokenChars = brokenMatches.slice(0, 3).join(', ');

  const gradeStyles = {
    'K-2': "children's book watercolor illustration",
    '3-5': "detailed children's book illustration",
    '6-8': 'realistic digital illustration',
    '9-12': 'professional digital artwork',
  };

  const oldPrompt = `Create a ${gradeStyles[gradeLevel]}, featuring ${
    brokenChars || 'generic elements'
  }, safe for children, G-rated content`;

  console.log(`🔴 Old System: "${oldPrompt}"`);
  console.log(`🟢 New System: "${enhancedPrompt}"`);

  console.log(`\n📈 Key Improvements:`);
  console.log(
    `   ✅ Content Type: ${analysis.contentType.type} (${analysis.contentType.confidence}% confidence)`,
  );
  const allConcepts = analysis.concepts.all || analysis.concepts;
  console.log(
    `   ✅ Characters: ${
      allConcepts.filter(c => c.category === 'characters').length
    } detected`,
  );
  console.log(
    `   ✅ Detailed Elements: ${
      analysis.concepts.detailed ? analysis.concepts.detailed.length : 0
    } story-specific`,
  );
  console.log(`   ✅ Themes: ${analysis.themes.length} identified`);
  console.log(
    `   ✅ Visual Concepts: ${analysis.visualConcepts.length} generated`,
  );
  console.log(`   ✅ Emotional Tone: ${analysis.emotionalTone.primary}`);

  // Generate actual image
  const imageResult = await generateImage(enhancedPrompt);

  let savedImagePath = null;

  if (imageResult?.success && imageResult?.imageUrl) {
    try {
      // Generate a descriptive filename
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .slice(0, 19);
      const contentType = analysis.contentType.type;
      const filename = `story-${contentType}-${gradeLevel}-${timestamp}.jpg`;

      // Download and save the image
      savedImagePath = await downloadImage(imageResult.imageUrl, filename);

      console.log(`\n${'='.repeat(60)}`);
      console.log(`🎨 IMAGE GENERATION & DOWNLOAD SUCCESS!`);
      console.log(`${'='.repeat(60)}`);
      console.log(`📸 Your generated image is ready!`);
      console.log(`🔗 Image URL: ${imageResult.imageUrl}`);
      console.log(`💾 Saved locally: ${savedImagePath}`);
      console.log(`⏱️ Generation took: ${imageResult.generationTime} seconds`);
      console.log(`🆔 Prediction ID: ${imageResult.predictionId}`);
    } catch (downloadError) {
      console.log(
        `\n⚠️ Image generated but download failed: ${downloadError.message}`,
      );
      console.log(`🔗 You can still access it at: ${imageResult.imageUrl}`);
      console.log(`💾 Prediction ID: ${imageResult.predictionId}`);
    }
  } else if (imageResult?.error) {
    console.log(`\n⚠️ Image generation failed: ${imageResult.error}`);
    console.log(`📝 But the enhanced prompt was successfully created!`);
  } else {
    console.log(`\n📝 Enhanced prompt created successfully!`);
    console.log(`💡 Add REPLICATE_API_TOKEN to .env to generate actual images`);
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ Enhanced Content Analysis Complete!`);
  console.log(`${'='.repeat(60)}`);

  console.log(`\n🚀 Summary:`);
  console.log(`1. ✅ Advanced content analysis performed`);
  console.log(`2. ✅ Contextually relevant prompt generated`);
  console.log(
    `3. ✅ ${
      imageResult?.success
        ? 'Image successfully generated and saved'
        : 'Ready for image generation'
    }`,
  );
  console.log(
    `4. ✅ ${
      savedImagePath
        ? `Image saved locally: ${path.basename(savedImagePath)}`
        : 'Image available online'
    }`,
  );
  console.log(`5. ✅ System ready for CreativeBridge integration`);

  return {
    analysis,
    prompt: enhancedPrompt,
    imageResult: {
      ...imageResult,
      savedPath: savedImagePath,
    },
    improvements: {
      contentType: analysis.contentType.type,
      confidence: analysis.contentType.confidence,
      charactersFound: analysis.concepts.filter(
        c => c.category === 'characters',
      ).length,
      themesIdentified: analysis.themes.length,
      visualConcepts: analysis.visualConcepts.length,
    },
  };
}

function getInsight(contentType, analysis) {
  const insights = {
    narrative: `Traditional story structure detected with clear characters and plot elements`,
    inspirational: `Motivational content identified with ${analysis.semanticThemes.length} themes and strong emotional resonance`,
    philosophical: `Deep conceptual content requiring symbolic visual representation`,
    abstract: `Pure conceptual content best rendered through metaphorical imagery`,
    poetic: `Lyrical content with rhythmic elements suitable for artistic interpretation`,
    instructional: `Step-by-step content requiring clear, procedural visualization`,
  };

  return insights[contentType] || 'Content type analyzed successfully';
}

// Run the single story analysis and image generation
runSingleStoryAnalysisAndGeneration().catch(error => {
  console.error('\n💥 Analysis and generation failed:', error);
  process.exit(1);
});
