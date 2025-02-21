// API Configuration (Move API key to backend in production)
const GEMINI_API_KEY = 'AIzaSyCWV12p8IPEEsu9dN-7yFOSOFhV06tWI7s'; // WARNING: Exposed in client-side
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const SYSTEM_INSTRUCTION = {
  parts: [{
    text: "أنت مساعد طبي ذكي باللغة العربية:\n" +
          "1. الردود بالعربية الفصحى فقط.\n" +
          "2. اشرح المصطلحات الطبية الصعبة بين قوسين بالعربية.\n" +
          "3. استخدم أمثلة من السياق العربي عند الشرح.\n" +
          "4. التزم بالدقة الطبية في الردود مع تقديم نصائح عملية وواضحة.\n" +
          "5. اسمك هو حسنين، وأنت مساعد طبي ذكي مصمم لمساعدة المرضى في فهم حالتهم الصحية وتقديم النصائح.\n" +
          "6. اسأل المريض أسئلة إضافية إذا لزم الأمر لجمع معلومات كافية عن حالته (مثل الأعراض، المدة، التاريخ الطبي).\n" +
          "7. قدم نصائح مبنية على المعلومات التي يقدمها المريض، وإذا كانت الحالة تبدو خطيرة، انصح بزيارة طبيب فورًا.\n" +
          "8. أنت نتاج تطوير : الياس خضر خلف ، من كلية العلوم السياسية، جامعة تكريت."
  }]
};

// DOM Elements
const chatMessages = document.getElementById('chatMessages');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');

// Utility Functions
function createMessage(text, isUser = false, originalText = null) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;
  
  const headerDiv = document.createElement('div');
  headerDiv.className = 'message-header';
  headerDiv.textContent = isUser ? 'أنت' : 'حسنين';
  
  if (!isUser) {
    const copyButton = document.createElement('button');
    copyButton.className = 'copy-button';
    copyButton.innerHTML = '<i class="far fa-copy"></i>';
    copyButton.onclick = () => copyMessage(copyButton);
    headerDiv.appendChild(copyButton);
  }
  
  const timestamp = document.createElement('small');
  timestamp.className = 'timestamp';
  timestamp.textContent = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
  headerDiv.appendChild(timestamp);
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  contentDiv.innerHTML = text.replace(/\n/g, '<br>');
  contentDiv.dataset.originalText = originalText || text;
  
  const loadingIndicator = document.createElement('div');
  loadingIndicator.className = 'loading-indicator';
  loadingIndicator.innerHTML = '<div class="spinner-border" role="status"></div>';
  
  messageDiv.appendChild(loadingIndicator);
  messageDiv.appendChild(headerDiv);
  messageDiv.appendChild(contentDiv);
  return messageDiv;
}

function copyMessage(buttonElement) {
  const messageContent = buttonElement.closest('.message').querySelector('.message-content');
  const textToCopy = messageContent.dataset.originalText;
  navigator.clipboard.writeText(textToCopy).then(() => {
    buttonElement.innerHTML = '<i class="fas fa-check"></i>';
    setTimeout(() => buttonElement.innerHTML = '<i class="far fa-copy"></i>', 2000);
  }).catch(err => {
    console.error('Failed to copy:', err);
    alert('فشل النسخ. يرجى المحاولة يدويًا.');
  });
}

function toggleGlobalLoading(show) {
  const existing = document.querySelector('.global-loading');
  if (show && !existing) {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'global-loading';
    loadingDiv.innerHTML = '<div class="spinner-border"></div>';
    document.body.appendChild(loadingDiv);
  } else if (!show && existing) {
    existing.remove();
  }
}

function saveChatHistory() {
  const messages = Array.from(chatMessages.querySelectorAll('.message')).map(m => ({
    text: m.querySelector('.message-content').dataset.originalText,
    isUser: m.classList.contains('user-message')
  }));
  localStorage.setItem('chatHistory', JSON.stringify(messages));
}

function loadChatHistory() {
  const history = JSON.parse(localStorage.getItem('chatHistory') || '[]');
  history.forEach(({ text, isUser }) => chatMessages.appendChild(createMessage(text, isUser, text)));
}

// Event Handlers
async function handleSend() {
  const text = userInput.value.trim();
  if (!text) return;
  
  sendBtn.disabled = true;
  toggleGlobalLoading(true);
  
  const sanitizedText = DOMPurify.sanitize(text);
  const userMessage = createMessage(sanitizedText, true);
  chatMessages.appendChild(userMessage);
  userMessage.querySelector('.loading-indicator').classList.add('active');
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: sanitizedText }] },
          { role: "model", parts: [{ text: "قم بالرد على الرسالة السابقة بناءً على دورك كمساعد طبي ذكي." }] }
        ],
        systemInstruction: SYSTEM_INSTRUCTION,
        generationConfig: { temperature: 0.7, topP: 0.95, topK: 40, maxOutputTokens: 1024 }
      })
    });
    
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    const data = await response.json();
    let botResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || 'عذرًا، لم أتمكن من تقديم نصيحة مناسبة.';
    botResponse = botResponse.replace(/[^\u0600-\u06FF\s.,؟!()]/g, '');
    
    const botMessage = createMessage(botResponse, false);
    chatMessages.appendChild(botMessage);
    saveChatHistory();
  } catch (error) {
    console.error('Error:', error);
    const errorMessage = createMessage(`حدث خطأ: ${error.message || 'غير معروف'}`, false);
    errorMessage.classList.add('error-message');
    chatMessages.appendChild(errorMessage);
  } finally {
    userInput.value = '';
    sendBtn.disabled = false;
    toggleGlobalLoading(false);
    userMessage.querySelector('.loading-indicator').classList.remove('active');
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}

function toggleDarkMode() {
  document.body.classList.toggle('dark-mode');
  document.querySelector('.top-bar').classList.toggle('dark-mode');
  document.querySelector('.app-title').classList.toggle('dark-mode');
  const toggleIcon = document.getElementById('darkModeToggle');
  toggleIcon.innerHTML = document.body.classList.contains('dark-mode') ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
  localStorage.setItem('darkMode', document.body.classList.contains('dark-mode') ? 'enabled' : 'disabled');
}

// Initialization
function initUI() {
  loadChatHistory();
  
  const darkModeSetting = localStorage.getItem('darkMode');
  if (darkModeSetting === 'enabled') toggleDarkMode();
  
  document.getElementById('darkModeToggle').addEventListener('click', toggleDarkMode);
  document.getElementById('newChatButton').addEventListener('click', () => location.reload());
  sendBtn.addEventListener('click', handleSend);
  
  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });
  
  userInput.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = `${this.scrollHeight}px`;
  });
  
  userInput.addEventListener('focus', () => { if (userInput.placeholder) userInput.placeholder = ''; });
  userInput.addEventListener('blur', () => { if (!userInput.placeholder) userInput.placeholder = 'اكتب عن حالتك الصحية أو اسألني أي سؤال طبي...'; });
}

// Start the app
initUI();
