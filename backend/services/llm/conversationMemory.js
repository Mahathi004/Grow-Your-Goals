const { HumanMessage, AIMessage } = require("@langchain/core/messages");

/**
 * Conversation Memory Service
 * Bridges Postgres JSONB chat history to LangChain Message format.
 */

const getHistoryFromDB = (chatHistoryJson) => {
  if (!chatHistoryJson || !Array.isArray(chatHistoryJson)) return [];

  return chatHistoryJson.map((msg) => {
    if (msg.role === 'user') {
      return new HumanMessage(msg.content);
    } else {
      return new AIMessage(msg.content);
    }
  });
};

const formatForDB = (history) => {
  return history.map(msg => ({
    role: msg instanceof HumanMessage ? 'user' : 'assistant',
    content: msg.content
  }));
};

module.exports = {
  getHistoryFromDB,
  formatForDB
};
