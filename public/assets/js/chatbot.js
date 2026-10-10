document.addEventListener("DOMContentLoaded", () => {
    // Inject HTML
    const chatbotHTML = `
        <button id="spider-chatbot-btn" aria-label="Abrir asistente IA">
            <i class="fa-solid fa-robot"></i>
        </button>
        <div id="spider-chatbot-window">
            <div class="chatbot-header">
                <span>Asistente SuperTec</span>
                <button id="spider-chatbot-close"><i class="fa-solid fa-times"></i></button>
            </div>
            <div class="chatbot-messages" id="spider-chatbot-messages">
                <div class="chat-msg bot">¡Hola! Soy el asistente virtual de SuperTec. ¿En qué te puedo ayudar hoy?</div>
            </div>
            <div class="chatbot-input">
                <input type="text" id="spider-chatbot-input" placeholder="Escribe tu mensaje..." autocomplete="off" />
                <button id="spider-chatbot-send"><i class="fa-solid fa-paper-plane"></i></button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', chatbotHTML);

    const btn = document.getElementById("spider-chatbot-btn");
    const chatWindow = document.getElementById("spider-chatbot-window");
    const closeBtn = document.getElementById("spider-chatbot-close");
    const sendBtn = document.getElementById("spider-chatbot-send");
    const inputField = document.getElementById("spider-chatbot-input");
    const messagesContainer = document.getElementById("spider-chatbot-messages");

    btn.addEventListener("click", () => {
        chatWindow.classList.add("active");
        btn.style.display = "none";
    });

    closeBtn.addEventListener("click", () => {
        chatWindow.classList.remove("active");
        btn.style.display = "flex";
    });

    const addMessage = (text, sender) => {
        const msgDiv = document.createElement("div");
        msgDiv.className = `chat-msg ${sender}`;
        msgDiv.innerText = text;
        messagesContainer.appendChild(msgDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    };

    const sendMessage = async () => {
        const text = inputField.value.trim();
        if (!text) return;

        addMessage(text, "user");
        inputField.value = "";
        
        // Show loading
        const loadingDiv = document.createElement("div");
        loadingDiv.className = "chat-msg bot loading";
        loadingDiv.innerText = "...";
        messagesContainer.appendChild(loadingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        try {
            const res = await fetch("/api/ia/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: text })
            });
            const data = await res.json();
            
            messagesContainer.removeChild(loadingDiv);
            if (data.success) {
                addMessage(data.reply, "bot");
            } else {
                addMessage("Lo siento, tuve un problema al procesar tu solicitud.", "bot");
            }
        } catch (error) {
            messagesContainer.removeChild(loadingDiv);
            addMessage("Error de conexión con el asistente.", "bot");
        }
    };

    sendBtn.addEventListener("click", sendMessage);
    inputField.addEventListener("keypress", (e) => {
        if (e.key === "Enter") sendMessage();
    });
});
