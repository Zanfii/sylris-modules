Hooks.on('renderChatMessage', (message, html, data) => {
  for (const chatMessage of html) {
    //1 Frame later as element doesn't exist this early
    setTimeout(() => {
      const messageControls = chatMessage.getElementsByClassName('chat-control')
      for (const controls of messageControls) {
        const deleteElement = document.createElement('a');
        const deleteButton = document.createElement('i')
        deleteButton.className = "fas fa-trash fa-fw";
        deleteElement.appendChild(deleteButton)
        window.test = deleteElement;
        deleteElement.onclick = () => {
          message.delete();
        }
        controls.parentNode.appendChild(deleteElement);
      }
    })
  }
});

Hooks.once('init', () => {

});
