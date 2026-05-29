const modifiers = {
  str: {name: 'Strength', code: 'str'},
  con: {name: 'Constitution', code: 'con'},
  dex: {name: 'Dexterity', code: 'dex'},
  int: {name: 'Intelligence', code: 'int'},
  wis: {name: 'Wisdom', code: 'wis'},
  cha: {name: 'Charisma', code: 'cha'}
};

const saveTypes = {
  fortitude: {
    name: 'Fortitude',
    mods: [modifiers.str, modifiers.con],
    macroID: 'YWqX4YpladH2RKjT'
  },
  reflex: {
    name: 'Reflex',
    mods: [modifiers.dex, modifiers.int],
    macroID: 'YJTJqV9bnjlSbaf5'
  },
  will: {
    name: 'Will',
    mods: [modifiers.wis, modifiers.cha],
    macroID: 'KsAPgPPKal7ClI60'
  }
};
const appliedMessages = [];

function log (...data) {
  console.log('sylris-saves: ', ...data);
}

function convertOldToNew (save) {
  switch (save) {
    case 'str':
    case 'con':
      return saveTypes.fortitude;
    case 'dex':
    case 'int':
      return saveTypes.reflex;
    case 'wis':
    case 'cha':
      return saveTypes.will;
    default:
      return undefined;
  }
}

function getOppositeSave (save) {
  switch (save) {
    case 'str':
      return modifiers.con
    case 'con':
      return modifiers.str
    case 'dex':
      return modifiers.int
    case 'int':
      return modifiers.dex
    case 'wis':
      return modifiers.cha
    case 'cha':
      return modifiers.wis
    default:
      return undefined;
  }
}

function getUserData () {
  let userData = {id: game.data.userId};
  for (let user of game.data.users) {
    if (user._id === userData.id) {
      userData.characterName = user.character;
    }
  }
  return userData;
}

function createChatMessage (message) {
  const chatData = {
    user: game.userId,
    speaker: ChatMessage.getSpeaker(),
    content: message
  };
  ChatMessage.create(chatData, {});
}

function createRollMessage (rollData, type, original, tokenName, tokenID) {
  const roll = new Roll(`1d20 + ${rollData.modifier}`);
  const speakerData = JSON.parse(JSON.stringify(ChatMessage.getSpeaker()));
  //Alias is the name displayed
  speakerData.alias = tokenName;
  //Actor is the image displayed with chat-images module
  speakerData.actor = tokenID;
  let chatData = {
    user: game.userId,
    speaker: speakerData,
    flavor: `${type} Saving Throw (${original})`,
  };
  roll.toMessage(chatData);
}

function createRollOfType (type, modifier = 0, advantage = false, disadvantage = false) {
  const saveType = saveTypes[type?.toLowerCase()];
  if (!saveType) {
    throw new Error('sylris-saves: invalid roll type passed to create roll dialog');
  }

  if (!canvas.tokens.controlled.length && !getUserData().id) {
    createChatMessage(`No tokens selected or owned for ${saveType.name} Save\nSelect a token before rolling`);
  } else {
    if (canvas.tokens.controlled.length) {
      //Can't control tokens that aren't owned, so no need to check ownership
      for (let tokens of canvas.tokens.controlled) {
        const name = tokens.actor.name;
        const mods = tokens.actor.system.abilities;
        if (mods) {
          let saveMod = {
            name: 'n/a',
            value: -Infinity
          };
          for (let abil of saveType.mods) {
            if (saveMod.value < mods[abil.code].save) {
              saveMod.value = mods[abil.code].save;
              saveMod.name = abil.name;
              saveMod.code = abil.code;
            }
          }
          if (saveMod.name !== 'n/a' && saveMod.value > -Infinity) {
            createRollMessage({modifier: saveMod.value}, saveType.name, saveMod.code, name, tokens.actor.id);
          } else {
            ui.notifications.warn(`Failed to values for ${name}`);
          }
        } else {
          ui.notifications.warn(`Failed to get data for name`);
        }
      }
    } else {
      //canvas.tokens.documentCollection.entries?
      //No tokens selected, use the assigned character instead
      ui.notifications.warn(`No token(s) selected, please select at least one token before attempting to roll.`);
    }
  }
}

function replaceText(text){
  text = text.replace("Strength", "Fortitude (Str)")
  text = text.replace("Dexterity", "Reflex (Dex)")
  text = text.replace("Constitution", "Fortitude (Con)")
  text = text.replace("Intelligence", "Reflex (Int)")
  text = text.replace("Wisdom", "Will (Wis)")
  text = text.replace("Charisma", "Will (Cha)")
  return text;
}

Hooks.on('renderChatMessage', (message, html, data) => {
  const isPoster = data.message.author === data.user._id;
  const match = data.message.content.match(/type="button" data-action="save" data-ability="([str|con|dex|int|wis|cha]+)" data-dc="(\d+)"/)
  const save = match?.[1];
  const dc = match?.[2] ?? "??";
  if (save) {
    const newSave = convertOldToNew(save)?.name;
    if (newSave) {
      for (const chatMessage of html) {
        const buttonSections = chatMessage.getElementsByClassName('card-buttons');
        for(const buttonSection of buttonSections){
          
          const button = document.createElement('button');
          button.type = 'button';
          button.setAttribute('data-action', 'save');
          button.setAttribute('data-ability', getOppositeSave(save).code);
          button.setAttribute('data-dc', dc);
          const icon = document.createElement('i');
          icon.className = 'fas fa-shield-heart';
          const visibleDcSpan = document.createElement('span');
          visibleDcSpan.className = 'visible-dc';
          visibleDcSpan.textContent = `DC ${dc} ${getOppositeSave(save).name} Saving Throw`;
          const hiddenDcSpan = document.createElement('span');
          hiddenDcSpan.className = 'hidden-dc';
          hiddenDcSpan.textContent = `${getOppositeSave(save).name} Saving Throw`;
          button.appendChild(icon);
          button.appendChild(visibleDcSpan);
          button.appendChild(hiddenDcSpan);


          buttonSection.childNodes.forEach(child => {
            if (child?.getAttribute?.("data-action") === "save"){
              if (child.nextElementSibling){
                buttonSection.insertBefore(button, child.nextElementSibling);
              } else {
                buttonSection.appendChild(button);
              }
            }
          })

          buttonSection.childNodes.forEach(child => {
            if (child?.getAttribute?.("data-action") === "save"){
              const visDC = child.getElementsByClassName("visible-dc")[0]
              const hidDC = child.getElementsByClassName("hidden-dc")[0]
              visDC.textContent =  replaceText(visDC.textContent)
              hidDC.textContent =  replaceText(hidDC.textContent)
            }
          })

        }
      }
    }
  }
})

window.SylrisAdditionalSaves = createRollOfType;