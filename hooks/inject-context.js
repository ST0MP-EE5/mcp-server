/**
 * Inject Context Hook
 * 
 * This hook runs at conversation start and can inject additional context.
 */

export default async function injectContext(event) {
  const { conversationId, userId } = event;
  
  // Example: Fetch user preferences
  // const preferences = await fetchUserPreferences(userId);
  
  return {
    context: {
      timestamp: new Date().toISOString(),
      // Add any additional context here
    }
  };
}
