// public/emoji.js

window.addEventListener('DOMContentLoaded', () => {
    const emojiToggle = document.getElementById('emoji-toggle');
    const emojiPicker = document.querySelector('emoji-picker');
    const input = document.getElementById('chat-input');
  
    if (!emojiPicker) return;
  
    emojiToggle.addEventListener('click', () => {
      emojiPicker.style.display = emojiPicker.style.display === 'none' ? 'block' : 'none';
    });
  
    emojiPicker.addEventListener('emoji-click', event => {
      input.value += event.detail.unicode;
      input.focus();
    });
  });
  