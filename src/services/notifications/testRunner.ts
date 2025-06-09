/**
 * Notification Message Test Runner
 * 
 * This file allows you to test notification messages manually
 * Run with: npx tsx src/services/notifications/testRunner.ts
 */

import { runAllTests, runSingleTest, testWeatherMessages, testScenarios } from './__tests__/notificationMessages.test';

const main = async () => {
  console.log('🚀 Starting Yugen Notification Message Tests\n');
  
  try {
    // You can uncomment different sections to test specific scenarios
    
    // Test all scenarios
    console.log('Running all test scenarios...');
    await runAllTests();
    
    // Test weather messages specifically
    console.log('\n\nTesting weather messages...');
    await testWeatherMessages();
    
    // Or test a specific scenario
    // console.log('\n\nTesting specific scenario...');
    // await runSingleTest(testScenarios[0]); // Craig + Easy Run
    
  } catch (error) {
    console.error('Test runner error:', error);
  }
};

// Run if this file is executed directly
if (require.main === module || import.meta.url === `file://${process.argv[1]}`) {
  main();
} 