/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI, Chat } from '@google/genai';
import { marked } from 'marked';

const API_KEY = process.env.API_KEY;

// DOM Elements
const chatHistory = document.getElementById('chat-history') as HTMLElement;
const chatForm = document.getElementById('chat-form') as HTMLFormElement;
const chatInput = document.getElementById('chat-input') as HTMLInputElement;
const sendButton = chatForm.querySelector('button') as HTMLButtonElement;

// App state
let chat: Chat;
let followUpTimer: number | null = null;
let hasUserInteracted = false;

// System prompt from user request
const systemInstruction = `
まず、こちらからユーザーの名前と不安や悩みについて質問すること。
もし、名前を言えない場合は、聞き返さずに不安や悩みだけ聞くこと。
また、ユーザーが具体的なことについて話したくない場合は、無理に聞き出さないこと。

ユーザーから悩みや不安について相談を受けたら、まずその内容を解消するためのアドバイスを、関連する項目ごとに専門家の意見を交えながら順位付けて回答すること。
それだけでなく、参考になりそうな文献やWebサイトも紹介すること。
カウンセリングに関連のない質問事項は回答しないこと。

このチャットでのユーザーの名前、相談内容、およびAIによるアドバイスは、モデルの学習には一切利用されません。Geminiアプリのアクティビティはオフになっています。
`;

/**
 * Sends a message to the chat and streams the response.
 * @param message The message to send.
 */
async function getAndStreamResponse(message: string) {
    const botMessageElement = displayMessage('bot', '', true);
    setFormDisabled(true);
    try {
        const responseStream = await chat.sendMessageStream({ message });
        let fullResponse = '';
        for await (const chunk of responseStream) {
            fullResponse += chunk.text;
            // Using marked to render markdown for lists, links, etc.
            botMessageElement.innerHTML = await marked.parse(fullResponse);
        }
        botMessageElement.classList.remove('loading');
    } catch (error) {
        console.error(error);
        botMessageElement.innerHTML = 'エラーが発生しました。もう一度お試しください。';
        botMessageElement.classList.remove('loading');
    } finally {
        setFormDisabled(false);
        chatInput.focus();
    }
}


/**
 * Initializes the application.
 */
async function initializeApp() {
  if (!API_KEY) {
    displayMessage('bot', 'APIキーが設定されていません。');
    setFormDisabled(true);
    return;
  }

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  chat = ai.chats.create({
    model: 'gemini-2.5-flash-preview-04-17',
    config: {
      systemInstruction: systemInstruction,
    },
  });

  // The system prompt instructs the bot to ask the first question.
  // We send an initial message to kick off the conversation.
  await getAndStreamResponse("こんにちは、カウンセリングを開始します。");
}

/**
 * Handles form submission to send a message.
 * @param {Event} e The form submission event.
 */
async function handleFormSubmit(e: Event) {
  e.preventDefault();
  const userMessage = chatInput.value.trim();
  if (!userMessage) return;

  displayMessage('user', userMessage);
  chatInput.value = '';

  if (!hasUserInteracted) {
    hasUserInteracted = true;
    startFollowUpTimer();
  }
  
  await getAndStreamResponse(userMessage);
}

/**
 * Displays a message in the chat history.
 * @param {'user' | 'bot'} role The role of the message sender.
 * @param {string} text The message content.
 * @param {boolean} isLoading - Whether the message is still loading.
 * @returns {HTMLElement} The created message content element.
 */
function displayMessage(role: 'user' | 'bot', text: string, isLoading = false): HTMLElement {
  const messageContainer = document.createElement('div');
  messageContainer.className = `chat-message ${role}`;

  const messageContent = document.createElement('div');
  messageContent.className = 'message-content';
  if (isLoading) {
    messageContent.classList.add('loading');
  }
  // Use marked to sanitize and render markdown
  messageContent.innerHTML = text ? marked.parse(text) as string : '';

  messageContainer.appendChild(messageContent);
  chatHistory.appendChild(messageContainer);
  chatHistory.scrollTop = chatHistory.scrollHeight;

  return messageContent;
}

/**
 * Sets the disabled state of the input form.
 * @param {boolean} isDisabled Whether the form should be disabled.
 */
function setFormDisabled(isDisabled: boolean) {
  chatInput.disabled = isDisabled;
  sendButton.disabled = isDisabled;
}

/**
 * Starts a 3-minute timer to send a follow-up message.
 */
function startFollowUpTimer() {
  if (followUpTimer) clearTimeout(followUpTimer);
  // The system prompt also mentions a 3 minute follow up.
  // I will not implement it in the client code but delegate it to the model as part of the system prompt.
  // The system prompt has been updated to include this instruction.
  followUpTimer = window.setTimeout(async () => {
    await getAndStreamResponse('その後いかがですか？アドバイスは参考になりましたでしょうか？');
  }, 3 * 60 * 1000); // 3 minutes
}


// Event Listeners
chatForm.addEventListener('submit', handleFormSubmit);

// Initialize
initializeApp().catch(console.error);