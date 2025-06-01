let currentSourceId = null;
let documents = [];
let apiKey = "";

// Initialize
window.onload = function () {
    loadApiKey();
    setupDragAndDrop();
    updateDocumentCount();
};

function loadApiKey() {
    // Check if API key exists in localStorage first
    const stored = localStorage.getItem("chatpdf_api_key");
    if (stored) {
        apiKey = stored;
        document.getElementById("apiKey").value = stored;
        return;
    }

    // If not found, prompt user
    const key = prompt("Please enter your ChatPDF API key:");
    if (key) {
        apiKey = key;
        document.getElementById("apiKey").value = key;
        localStorage.setItem("chatpdf_api_key", key);
    }
}

function saveApiKey() {
    const key = document.getElementById("apiKey").value.trim();
    if (key) {
        apiKey = key;
        localStorage.setItem("chatpdf_api_key", key);
        showMessage("API key saved successfully!", "success");
        enableChatIfReady();
    } else {
        showMessage("Please enter a valid API key", "error");
    }
}

function toggleApiKeyVisibility() {
    const input = document.getElementById("apiKey");
    const icon = document.getElementById("toggleIcon");

    if (input.type === "password") {
        input.type = "text";
        icon.classList.remove("fa-eye");
        icon.classList.add("fa-eye-slash");
    } else {
        input.type = "password";
        icon.classList.remove("fa-eye-slash");
        icon.classList.add("fa-eye");
    }
}

function setupDragAndDrop() {
    const uploadArea = document.querySelector(".upload-area");

    uploadArea.addEventListener("dragover", (e) => {
        e.preventDefault();
        uploadArea.classList.add("dragover");
    });

    uploadArea.addEventListener("dragleave", (e) => {
        // Only remove dragover if we're leaving the upload area entirely
        if (!uploadArea.contains(e.relatedTarget)) {
            uploadArea.classList.remove("dragover");
        }
    });

    uploadArea.addEventListener("drop", (e) => {
        e.preventDefault();
        uploadArea.classList.remove("dragover");

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file) {
        handleFile(file);
    }
}

async function handleFile(file) {
    if (!apiKey) {
        showMessage("Please enter your ChatPDF API key first", "error");
        return;
    }

    if (file.type !== "application/pdf") {
        showMessage("Please upload a PDF file", "error");
        return;
    }

    if (file.size > 32 * 1024 * 1024) {
        showMessage("File size must be less than 32MB", "error");
        return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
        showLoadingOverlay(true);
        showMessage("Uploading document...", "loading");

        const response = await fetch(
            "https://api.chatpdf.com/v1/sources/add-file",
            {
                method: "POST",
                headers: {
                    "x-api-key": apiKey,
                },
                body: formData,
            }
        );

        const result = await response.json();

        if (response.ok) {
            currentSourceId = result.sourceId;
            const doc = {
                id: result.sourceId,
                name: file.name,
                size: file.size,
                uploadTime: new Date().toLocaleString(),
            };
            documents.push(doc);

            updateDocumentsList();
            updateDocumentCount();
            enableChatIfReady();
            showMessage(`Successfully uploaded: ${file.name}`, "success");

            // Clear the file input
            document.getElementById("fileInput").value = "";
        } else {
            throw new Error(result.message || "Upload failed");
        }
    } catch (error) {
        console.error("Upload error:", error);
        showMessage(`Upload failed: ${error.message}`, "error");
    } finally {
        showLoadingOverlay(false);
    }
}

function updateDocumentsList() {
    const docsList = document.getElementById("documentsList");

    if (documents.length === 0) {
        docsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>No documents uploaded yet</p>
            </div>
        `;
        return;
    }

    docsList.innerHTML = documents
        .map(
            (doc) => `
            <div class="document-item">
                <div class="document-name">${doc.name}</div>
                <div class="document-meta">
                    <span>${formatFileSize(doc.size)} • ${doc.uploadTime}</span>
                    <button class="delete-btn" onclick="deleteDocument('${
                        doc.id
                    }')" title="Delete document">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `
        )
        .join("");
}

function updateDocumentCount() {
    const countElement = document.getElementById("documentCount");
    countElement.textContent = documents.length;
}

function enableChatIfReady() {
    const messageInput = document.getElementById("messageInput");
    const sendBtn = document.getElementById("sendBtn");
    const clearBtn = document.getElementById("clearChatBtn");

    const hasApiKey = !!apiKey;
    const hasDocument = !!currentSourceId;
    const canChat = hasApiKey && hasDocument;

    messageInput.disabled = !canChat;
    sendBtn.disabled = !canChat;

    if (canChat) {
        messageInput.placeholder = "Ask anything about your document...";
        clearBtn.style.display = "inline-flex";
    } else if (!hasApiKey) {
        messageInput.placeholder = "Enter your API key first...";
    } else {
        messageInput.placeholder = "Upload a document to start chatting...";
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

async function deleteDocument(sourceId) {
    if (!confirm("Are you sure you want to delete this document?")) {
        return;
    }

    try {
        showMessage("Deleting document...", "loading");

        await fetch(`https://api.chatpdf.com/v1/sources/delete`, {
            method: "POST",
            headers: {
                "x-api-key": apiKey,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ sources: [sourceId] }),
        });

        documents = documents.filter((doc) => doc.id !== sourceId);

        if (currentSourceId === sourceId) {
            currentSourceId =
                documents.length > 0
                    ? documents[documents.length - 1].id
                    : null;
        }

        updateDocumentsList();
        updateDocumentCount();
        enableChatIfReady();
        showMessage("Document deleted successfully", "success");
    } catch (error) {
        console.error("Delete error:", error);
        showMessage("Failed to delete document", "error");
    }
}

function clearChat() {
    if (!confirm("Are you sure you want to clear the chat history?")) {
        return;
    }

    const messagesContainer = document.getElementById("messages");
    messagesContainer.innerHTML = `
        <div class="message assistant welcome-message">
            <div class="message-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="message-content">
                Chat cleared! You can continue asking questions about your document.
            </div>
        </div>
    `;
}

function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

async function sendMessage() {
    if (!apiKey) {
        showMessage("Please enter your ChatPDF API key first", "error");
        return;
    }

    if (!currentSourceId) {
        showMessage("Please upload a PDF document first", "error");
        return;
    }

    const messageInput = document.getElementById("messageInput");
    const message = messageInput.value.trim();

    if (!message) return;

    // Add user message to chat
    addMessageToChat(message, "user");
    messageInput.value = "";

    // Auto-resize textarea
    messageInput.style.height = "auto";

    // Show loading state
    const loadingId = addMessageToChat("Thinking...", "assistant", true);

    try {
        const response = await fetch(
            "https://api.chatpdf.com/v1/chats/message",
            {
                method: "POST",
                headers: {
                    "x-api-key": apiKey,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    sourceId: currentSourceId,
                    messages: [
                        {
                            role: "user",
                            content: message,
                        },
                    ],
                }),
            }
        );

        const result = await response.json();

        // Remove loading message
        document.getElementById(loadingId).remove();

        if (response.ok) {
            addMessageToChat(result.content, "assistant");
        } else {
            throw new Error(result.message || "Failed to get response");
        }
    } catch (error) {
        console.error("Chat error:", error);
        document.getElementById(loadingId).remove();
        addMessageToChat(
            `Sorry, I encountered an error: ${error.message}`,
            "assistant"
        );
    }
}

function addMessageToChat(content, sender, isLoading = false) {
    const messagesContainer = document.getElementById("messages");
    const messageId = `msg-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;

    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${sender}`;
    messageDiv.id = messageId;

    const avatar =
        sender === "user"
            ? '<i class="fas fa-user"></i>'
            : '<i class="fas fa-robot"></i>';

    const loadingSpinner = isLoading ? '<div class="spinner"></div>' : "";

    messageDiv.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-content">
            ${
                isLoading
                    ? `<div class="loading">${loadingSpinner} ${content}</div>`
                    : content
            }
        </div>
    `;

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    return messageId;
}

function showLoadingOverlay(show) {
    const overlay = document.getElementById("loadingOverlay");
    overlay.style.display = show ? "flex" : "none";
}

function showMessage(message, type) {
    // Remove existing messages
    const existing = document.querySelector(".error, .success, .loading");
    if (existing) {
        existing.remove();
    }

    const messageDiv = document.createElement("div");
    messageDiv.className = type;

    if (type === "loading") {
        messageDiv.innerHTML = `<div class="loading"><div class="spinner"></div> ${message}</div>`;
    } else {
        messageDiv.textContent = message;
    }

    const uploadSection = document.querySelector(".upload-section");
    uploadSection.insertBefore(messageDiv, uploadSection.firstChild);

    if (type !== "loading") {
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 5000);
    }
}

// Auto-resize textarea
document.getElementById("messageInput").addEventListener("input", function () {
    this.style.height = "auto";
    this.style.height = this.scrollHeight + "px";
});
