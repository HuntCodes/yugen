import { generateCoachMessage, getWeatherMessage, TodaysWorkout } from '../notificationService';

// Test scenarios covering different combinations
export const testScenarios = [
  {
    name: 'Craig + Easy Run + Perfect Weather',
    coachId: 'craig',
    workout: {
      sessionType: 'Easy Run',
      distance: 6,
      time: 36,
      notes: 'Conversational pace'
    } as TodaysWorkout,
    weather: { lat: 40.7128, lon: -74.0060 }, // NYC
    expectedKeywords: ['Rise and shine', 'easy', '6km', '36 minutes', "Let's get after it"]
  },
  {
    name: 'Craig + Tempo Run + Clear Weather',
    coachId: 'craig',
    workout: {
      sessionType: 'Tempo Run',
      distance: 8,
      time: 45,
      notes: '3x2km at threshold pace'
    } as TodaysWorkout,
    weather: { lat: 40.7128, lon: -74.0060 },
    expectedKeywords: ['Rise and shine', 'tempo', '8km', '45 minutes', 'sweet spot']
  },
  {
    name: 'Craig + Intervals + Weather',
    coachId: 'craig',
    workout: {
      sessionType: 'Interval Training',
      distance: 7,
      time: 35,
      notes: '6x800m at 5k pace'
    } as TodaysWorkout,
    weather: { lat: 40.7128, lon: -74.0060 },
    expectedKeywords: ['Rise and shine', 'intervals', '7km', '35 minutes', 'get fast']
  },
  {
    name: 'Craig + Long Run',
    coachId: 'craig',
    workout: {
      sessionType: 'Long Run',
      distance: 20,
      time: 120,
      notes: 'Build to marathon pace in final 5km'
    } as TodaysWorkout,
    weather: { lat: 40.7128, lon: -74.0060 },
    expectedKeywords: ['Rise and shine', 'long run', '20km', '120 minutes', 'steady endurance']
  },
  {
    name: 'Craig + Rest Day',
    coachId: 'craig',
    workout: {
      sessionType: 'Rest Day',
      distance: 0,
      time: 0,
      notes: 'Complete rest'
    } as TodaysWorkout,
    weather: { lat: 40.7128, lon: -74.0060 },
    expectedKeywords: ['Rise and shine', 'rest day', 'recovery', 'just as important']
  },
  {
    name: 'Thomas + Easy Run',
    coachId: 'thomas',
    workout: {
      sessionType: 'Easy Run',
      distance: 5,
      time: 32,
      notes: 'Focus on form'
    } as TodaysWorkout,
    weather: { lat: 40.7128, lon: -74.0060 },
    expectedKeywords: ['Good morning, athlete', 'easy', '5km', '32 minutes', 'every step counts']
  },
  {
    name: 'Thomas + Speed Work',
    coachId: 'thomas',
    workout: {
      sessionType: 'Speed Work',
      distance: 6,
      time: 30,
      notes: '10x400m'
    } as TodaysWorkout,
    weather: { lat: 40.7128, lon: -74.0060 },
    expectedKeywords: ['Good morning, athlete', '6km', '30 minutes', 'guidance']
  },
  {
    name: 'Dathan + Recovery Run',
    coachId: 'dathan',
    workout: {
      sessionType: 'Recovery Run',
      distance: 4,
      time: 25,
      notes: 'Very easy effort'
    } as TodaysWorkout,
    weather: { lat: 40.7128, lon: -74.0060 },
    expectedKeywords: ['Morning, runner', 'easy', '4km', '25 minutes', 'Smart training beats hard training']
  },
  {
    name: 'Dathan + No Workout',
    coachId: 'dathan',
    workout: null,
    weather: { lat: 40.7128, lon: -74.0060 },
    expectedKeywords: ['Morning, runner', "don't see a specific workout", 'good day to move', 'questions']
  },
  {
    name: 'Thomas + No Weather (Location Error)',
    coachId: 'thomas',
    workout: {
      sessionType: 'Easy Run',
      distance: 5,
      time: 30,
      notes: 'Easy pace'
    } as TodaysWorkout,
    weather: null, // No location
    expectedKeywords: ['Good morning, athlete', 'easy', '5km', "perfect day for a run"]
  }
];

/**
 * Run a single test scenario and log the results
 */
export const runSingleTest = async (scenario: typeof testScenarios[0]) => {
  console.log(`\n🏃‍♂️ Testing: ${scenario.name}`);
  console.log('=' .repeat(50));
  
  try {
    // Generate the message
    const message = await generateCoachMessage(
      scenario.coachId,
      scenario.workout,
      scenario.weather?.lat,
      scenario.weather?.lon
    );

    console.log(`📱 Generated Message:`);
    console.log(`"${message}"`);
    console.log(`\n📊 Analysis:`);
    console.log(`- Length: ${message.length} characters`);
    console.log(`- Coach: ${scenario.coachId}`);
    console.log(`- Workout: ${scenario.workout ? `${scenario.workout.sessionType} - ${scenario.workout.distance}km` : 'None'}`);
    
    // Check for expected keywords
    const foundKeywords: string[] = [];
    const missingKeywords: string[] = [];
    
    scenario.expectedKeywords.forEach(keyword => {
      if (message.toLowerCase().includes(keyword.toLowerCase())) {
        foundKeywords.push(keyword);
      } else {
        missingKeywords.push(keyword);
      }
    });

    console.log(`- Keywords found: ${foundKeywords.join(', ')}`);
    if (missingKeywords.length > 0) {
      console.log(`- Keywords missing: ${missingKeywords.join(', ')}`);
    }
    
    // Quality checks
    const qualityIssues: string[] = [];
    if (message.length < 50) qualityIssues.push('Message too short');
    if (message.length > 300) qualityIssues.push('Message too long for notification');
    if (!message.includes('!') && !message.includes('.')) qualityIssues.push('Missing punctuation');
    
    if (qualityIssues.length > 0) {
      console.log(`⚠️  Quality Issues: ${qualityIssues.join(', ')}`);
    } else {
      console.log(`✅ Quality: Good`);
    }

    return {
      scenario: scenario.name,
      message,
      keywordsFound: foundKeywords.length,
      keywordsTotal: scenario.expectedKeywords.length,
      qualityIssues,
      success: missingKeywords.length === 0 && qualityIssues.length === 0
    };

  } catch (error) {
    console.log(`❌ Error: ${error}`);
    return {
      scenario: scenario.name,
      message: '',
      keywordsFound: 0,
      keywordsTotal: scenario.expectedKeywords.length,
      qualityIssues: [`Error: ${error}`],
      success: false
    };
  }
};

/**
 * Run all test scenarios
 */
export const runAllTests = async () => {
  console.log('🎯 YUGEN NOTIFICATION MESSAGE TESTING SUITE');
  console.log('='.repeat(60));
  console.log('Testing different coaches, workouts, and weather conditions...\n');
  
  const results = [];
  
  for (const scenario of testScenarios) {
    const result = await runSingleTest(scenario);
    results.push(result);
    
    // Small delay to avoid rate limiting if weather service is called
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Summary
  console.log('\n📈 SUMMARY');
  console.log('='.repeat(30));
  
  const successful = results.filter(r => r.success).length;
  const total = results.length;
  
  console.log(`Tests passed: ${successful}/${total}`);
  console.log(`Success rate: ${Math.round((successful/total) * 100)}%`);
  
  if (successful < total) {
    console.log('\n❌ Failed tests:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`- ${r.scenario}: ${r.qualityIssues.join(', ')}`);
    });
  }
  
  console.log('\n🎉 Testing complete!');
  return results;
};

/**
 * Test weather messages specifically
 */
export const testWeatherMessages = async () => {
  console.log('\n🌤️  WEATHER MESSAGE TESTING');
  console.log('='.repeat(40));
  
  const weatherTests = [
    { name: 'NYC Coordinates', lat: 40.7128, lon: -74.0060 },
    { name: 'London Coordinates', lat: 51.5074, lon: -0.1278 },
    { name: 'Sydney Coordinates', lat: -33.8688, lon: 151.2093 },
    { name: 'No Location', lat: undefined, lon: undefined }
  ];
  
  for (const test of weatherTests) {
    console.log(`\n📍 Testing: ${test.name}`);
    try {
      const message = await getWeatherMessage(test.lat, test.lon);
      console.log(`Weather message: "${message}"`);
    } catch (error) {
      console.log(`Error: ${error}`);
    }
    await new Promise(resolve => setTimeout(resolve, 1000)); // Prevent rate limiting
  }
};

/**
 * Interactive test runner - uncomment to use in development
 */
/*
(async () => {
  if (require.main === module) {
    // Run all tests
    await runAllTests();
    
    // Test weather messages
    await testWeatherMessages();
  }
})();
*/ 