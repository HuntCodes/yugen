/**
 * @deprecated This file has been refactored. Please use the following modules instead:
 * - useAdjustmentLogic: Main hook that coordinates the plan adjustment workflow
 * - useAdjustmentParser: Functions for parsing user messages and generating adjustments
 * - useAdjustmentStorage: Functions for storing adjustments in the database
 */

import { useAdjustmentLogic } from './useAdjustmentLogic';
import { useAdjustmentParser } from './useAdjustmentParser';
import { useAdjustmentStorage } from './useAdjustmentStorage';
export { PlanUpdate, ChatMessage } from '../chat/types';

export function usePlanAdjustment() {
  // Get functions from the refactored modules
  const adjustmentLogic = useAdjustmentLogic();
  const adjustmentParser = useAdjustmentParser();
  const adjustmentStorage = useAdjustmentStorage();
  
  // Combine and return all the functions from the refactored modules
  return {
    // From useAdjustmentParser
    hasPlanFeedback: adjustmentParser.hasPlanFeedback,
    isConfirmingPlanUpdate: adjustmentParser.isConfirmingPlanUpdate,
    isRejectingPlanUpdate: adjustmentParser.isRejectingPlanUpdate,
    generateConfirmationMessage: adjustmentParser.generateConfirmationMessage,
    
    // Previously named handlePlanAdjustment, now generatePlanAdjustment
    handlePlanAdjustment: adjustmentParser.generatePlanAdjustment,
    
    // From useAdjustmentStorage
    applyPlanChangeToSupabase: adjustmentStorage.applyPlanChangeToSupabase,
    testDatabasePermissions: adjustmentStorage.testDatabasePermissions,
    
    // New functions from useAdjustmentLogic
    handleMessage: adjustmentLogic.handleMessage,
    hasPendingAdjustment: adjustmentLogic.hasPendingAdjustment,
    clearPendingAdjustment: adjustmentLogic.clearPendingAdjustment
  };
}