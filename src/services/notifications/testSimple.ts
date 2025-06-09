/**
 * Simple notification message testing without React Native dependencies
 * This demonstrates what the notification messages would look like
 */

interface TodaysWorkout {
  sessionType: string;
  distance: number;
  time: number;
  notes: string;
}

// Mock coach data
const COACHES = [
  {
    id: 'craig',
    name: 'Craig Mottram',
    vibe: 'Motivational and high energy',
    philosophy: 'Run fast, rest hard. Recovery is key.',
    personalityBlurb: 'Aussie legend. Straight talker. Big on consistency.'
  },
  {
    id: 'thomas',
    name: 'Thomas Dreissigacker',
    vibe: 'Technical and precise',
    philosophy: 'Every step counts. Form is everything.',
    personalityBlurb: 'Detail-oriented. Believes in perfect technique.'
  },
  {
    id: 'dathan',
    name: 'Dathan Ritzenhein',
    vibe: 'Smart and strategic',
    philosophy: 'Smart training beats hard training every time.',
    personalityBlurb: 'Strategic thinker. Data-driven approach.'
  }
];

// Mock weather function
const mockGetWeatherMessage = (temp: number, description: string): string => {
  if (temp < 5) {
    return `It's chilly at ${temp}°C with ${description.toLowerCase()}, but that's perfect running weather`;
  } else if (temp > 25) {
    return `It's warm at ${temp}°C with ${description.toLowerCase()}, so stay hydrated out there`;
  } else if (description.includes('rain')) {
    return `There's some rain with ${description.toLowerCase()} - embrace the elements`;
  } else {
    return `It's ${temp}°C with ${description.toLowerCase()} - ideal conditions for your run`;
  }
};

// Simplified message generation
const generateMockCoachMessage = (
  coachId: string, 
  workout: TodaysWorkout | null, 
  temp: number = 18,
  weather: string = 'partly cloudy',
  nickname?: string
): string => {
  const coach = COACHES.find(c => c.id === coachId);
  
  if (!coach) {
    return "Good morning! Ready to crush today's run?";
  }
  
  // Get weather message
  const weatherMessage = mockGetWeatherMessage(temp, weather);
  
  // Base greeting with coach personality and nickname
  let greeting = "Good morning";
  if (coachId === 'craig') {
    greeting = nickname ? `Rise and shine, ${nickname}` : "Rise and shine";
  } else if (coachId === 'thomas') {
    greeting = nickname ? `Good morning, ${nickname}` : "Good morning, athlete";
  } else if (coachId === 'dathan') {
    greeting = nickname ? `Morning, ${nickname}` : "Morning, runner";
  }
  
  // Workout-specific message
  let workoutMessage = "";
  if (workout) {
    const sessionType = workout.sessionType.toLowerCase();
    const distance = workout.distance;
    const timeMinutes = Math.round(workout.time);
    
    if (sessionType.includes('easy') || sessionType.includes('recovery')) {
      workoutMessage = `Today you've got an easy ${distance}km run (about ${timeMinutes} minutes)`;
    } else if (sessionType.includes('tempo') || sessionType.includes('threshold')) {
      workoutMessage = `Today you've got a ${distance}km tempo run (${timeMinutes} minutes) - time to find that sweet spot`;
    } else if (sessionType.includes('interval') || sessionType.includes('speed')) {
      workoutMessage = `Today you've got ${distance}km of intervals (${timeMinutes} minutes) - let's get fast`;
    } else if (sessionType.includes('long')) {
      workoutMessage = `Today you've got your long run - ${distance}km (${timeMinutes} minutes) of steady endurance`;
    } else if (sessionType.includes('rest')) {
      workoutMessage = `Today is a rest day - recovery is just as important as the hard work`;
    } else {
      workoutMessage = `Today you've got a ${distance}km ${sessionType} run (${timeMinutes} minutes)`;
    }
  } else {
    workoutMessage = "I don't see a specific workout scheduled, but every day is a good day to move";
  }
  
  // Coach-specific motivational close
  let motivation = "";
  if (coachId === 'craig') {
    motivation = "Let's get after it! Hit me up if you need any adjustments or advice.";
  } else if (coachId === 'thomas') {
    motivation = "Remember, every step counts. Let me know if you want to make any changes or need guidance.";
  } else if (coachId === 'dathan') {
    motivation = "Smart training beats hard training. Message me if you need any tweaks or have questions.";
  } else {
    motivation = "Let me know if you need any advice or want to make any changes!";
  }
  
  return `${greeting}! ${workoutMessage}. ${weatherMessage}, so let's get going. ${motivation}`;
};

// Test scenarios
const testScenarios = [
  {
    name: 'Craig + Easy Run + Perfect Weather',
    coachId: 'craig',
    workout: {
      sessionType: 'Easy Run',
      distance: 6,
      time: 36,
      notes: 'Conversational pace'
    },
    weather: { temp: 18, description: 'partly cloudy' },
    nickname: undefined,
    expectedKeywords: ['Rise and shine', 'easy', '6km', '36 minutes', "Let's get after it"]
  },
  {
    name: 'Craig + Easy Run + Perfect Weather + Nickname',
    coachId: 'craig',
    workout: {
      sessionType: 'Easy Run',
      distance: 6,
      time: 36,
      notes: 'Conversational pace'
    },
    weather: { temp: 18, description: 'partly cloudy' },
    nickname: 'Alex',
    expectedKeywords: ['Rise and shine, Alex', 'easy', '6km', '36 minutes', "Let's get after it"]
  },
  {
    name: 'Craig + Tempo Run + Clear Weather',
    coachId: 'craig',
    workout: {
      sessionType: 'Tempo Run',
      distance: 8,
      time: 45,
      notes: '3x2km at threshold pace'
    },
    weather: { temp: 22, description: 'clear sky' },
    nickname: undefined,
    expectedKeywords: ['Rise and shine', 'tempo', '8km', '45 minutes', 'sweet spot']
  },
  {
    name: 'Craig + Intervals + Rainy Weather',
    coachId: 'craig',
    workout: {
      sessionType: 'Interval Training',
      distance: 7,
      time: 35,
      notes: '6x800m at 5k pace'
    },
    weather: { temp: 15, description: 'light rain' },
    nickname: undefined,
    expectedKeywords: ['Rise and shine', 'intervals', '7km', '35 minutes', 'get fast', 'rain']
  },
  {
    name: 'Craig + Long Run + Cool Weather',
    coachId: 'craig',
    workout: {
      sessionType: 'Long Run',
      distance: 20,
      time: 120,
      notes: 'Build to marathon pace'
    },
    weather: { temp: 12, description: 'overcast' },
    nickname: undefined,
    expectedKeywords: ['Rise and shine', 'long run', '20km', '120 minutes', 'steady endurance']
  },
  {
    name: 'Craig + Rest Day + Perfect Weather',
    coachId: 'craig',
    workout: {
      sessionType: 'Rest Day',
      distance: 0,
      time: 0,
      notes: 'Complete rest'
    },
    weather: { temp: 20, description: 'partly cloudy' },
    nickname: undefined,
    expectedKeywords: ['Rise and shine', 'rest day', 'recovery', 'just as important']
  },
  {
    name: 'Thomas + Easy Run + Hot Weather + Nickname',
    coachId: 'thomas',
    workout: {
      sessionType: 'Easy Run',
      distance: 5,
      time: 32,
      notes: 'Focus on form'
    },
    weather: { temp: 28, description: 'clear sky' },
    nickname: 'Sarah',
    expectedKeywords: ['Good morning, Sarah', 'easy', '5km', '32 minutes', 'warm at 28°C', 'every step counts']
  },
  {
    name: 'Thomas + Speed Work + Cold Weather',
    coachId: 'thomas',
    workout: {
      sessionType: 'Speed Work',
      distance: 6,
      time: 30,
      notes: '10x400m'
    },
    weather: { temp: 2, description: 'light snow' },
    nickname: undefined,
    expectedKeywords: ['Good morning, athlete', '6km', '30 minutes', 'chilly at 2°C', 'perfect running weather']
  },
  {
    name: 'Dathan + Recovery Run + Pleasant Weather + Nickname',
    coachId: 'dathan',
    workout: {
      sessionType: 'Recovery Run',
      distance: 4,
      time: 25,
      notes: 'Very easy effort'
    },
    weather: { temp: 16, description: 'partly cloudy' },
    nickname: 'Mike',
    expectedKeywords: ['Morning, Mike', 'easy', '4km', '25 minutes', 'Smart training beats hard training']
  },
  {
    name: 'Dathan + No Workout + Pleasant Weather',
    coachId: 'dathan',
    workout: null,
    weather: { temp: 19, description: 'clear sky' },
    nickname: undefined,
    expectedKeywords: ['Morning, runner', "don't see a specific workout", 'good day to move', 'questions']
  }
];

// Run tests
const runTests = () => {
  console.log('🏃‍♂️ YUGEN NOTIFICATION MESSAGE TESTS 🏃‍♂️');
  console.log('='.repeat(60));
  console.log('Testing different coaches, workouts, and weather conditions...\n');
  
  let passedTests = 0;
  
  testScenarios.forEach((scenario, index) => {
    console.log(`\n📱 Test ${index + 1}: ${scenario.name}`);
    console.log('='.repeat(50));
    
    const message = generateMockCoachMessage(
      scenario.coachId,
      scenario.workout,
      scenario.weather.temp,
      scenario.weather.description,
      scenario.nickname
    );
    
    console.log(`Generated Message:`);
    console.log(`"${message}"`);
    console.log(`\nAnalysis:`);
    console.log(`- Length: ${message.length} characters`);
    console.log(`- Coach: ${scenario.coachId}`);
    console.log(`- Workout: ${scenario.workout ? `${scenario.workout.sessionType} - ${scenario.workout.distance}km` : 'None'}`);
    console.log(`- Weather: ${scenario.weather.temp}°C, ${scenario.weather.description}`);
    console.log(`- Nickname: ${scenario.nickname || 'None (generic greeting)'}`);
    
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
    
    const passed = missingKeywords.length === 0 && qualityIssues.length === 0;
    
    if (qualityIssues.length > 0) {
      console.log(`⚠️  Quality Issues: ${qualityIssues.join(', ')}`);
    } else {
      console.log(`✅ Quality: Good`);
    }
    
    if (passed) {
      console.log(`✅ Test PASSED`);
      passedTests++;
    } else {
      console.log(`❌ Test FAILED`);
    }
  });
  
  console.log('\n📈 SUMMARY');
  console.log('='.repeat(30));
  console.log(`Tests passed: ${passedTests}/${testScenarios.length}`);
  console.log(`Success rate: ${Math.round((passedTests/testScenarios.length) * 100)}%`);
  
  console.log('\n🎉 Testing complete!');
};

// Run the tests
runTests(); 