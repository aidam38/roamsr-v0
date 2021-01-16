console.log("Loading roam-sr.js.");

if (!window.roamsr) {
  window.roamsr = {};
}

// --- Default settings ---
roamsr.settings = {
  time: 200, // Time between user events (clicks & stuff), increase if bugs
  easeFactor: 2.5,
  responses: [
    "Just learned.",
    "Forgotten.",
    "Remembered."
  ],
  srTag: "sr",
}

roamsr.settings = Object.assign(roamsr.settings, window.roamsrSettings);

// --- Variables ---
roamsr.prompts = {};
roamsr.promptCounter = -1;
roamsr.mode = false;
roamsr.deltaRegex = /[0-9]+(?=\+0\}\})/g;

// --- Basic helper functions ---
// Sleep promise
roamsr.sleep = m => {
  var t = m ? m : roamsr.settings.time;
  return new Promise(r => setTimeout(r, t))
};

// Remove element by id
roamsr.removeId = (id) => {
  let element = document.getElementById(id);
  if (element) element.remove();
}

// Add element to target
roamsr.addElement = (element, target) => {
  if (element.id) roamsr.removeId(element.id)
  target.appendChild(element);
};

// simulateClick by Viktor Tabori
roamsr.simulateClick = (element, opts) => {
  events = ["mousehover", "mousedown", "click", "mouseup"];
  setTimeout(function () {
    events.forEach(function (type) {
      var _event = new MouseEvent(type, {
        view: window,
        bubbles: true,
        cancelable: true,
        buttons: 1,
        ...opts
      });
      _event.simulated = true;
      element.dispatchEvent(_event);
    });
  }, 0);
};

// --- Testing routine ---
var scriptUrl = document.currentScript.src
var scriptId = document.currentScript.id;
roamsr.testingReload = () => {
  roamsr.setMode(false);
  try {
    roamsr.removeId(scriptId);
    roamsr.removeId("roamsr-review-button");
    roamsr.removeId("roamsr-refresh-button");
    roamsr.removeId("roamsr-counter-widget");
  } catch (e) { }

  document.getElementsByTagName("head")[0].appendChild(
    Object.assign(document.createElement("script"), {
      id: scriptId,
      src: scriptUrl,
      type: "text/javascript"
    }));
};

// Create refresh button
var refreshButton = Object.assign(document.createElement("div"), {
  id: "roamsr-refresh-button",
  className: "bp3-button bp3-minimal bp3-small bp3-icon-refresh",
  onclick: roamsr.testingReload
});

// Comment/uncomment here for debugging
// roamsr.addElement(refreshButton, document.querySelector(".roam-topbar .flex-h-box"));

// --- Main helper functions ---

// Go to uid
roamsr.goToUid = (uid) => {
  let baseUrl = "/" + new URL(window.location.href).hash.split("/").slice(0, 3).join("/");
  let url = uid ? baseUrl + "/page/" + uid : baseUrl;
  location.assign(url);
}

// Show/hide block/refs (Cloze deletion)
roamsr.showBlockRefs = show => {
  document.querySelectorAll(".rm-block-ref").forEach(blockref => {
    blockref.classList.toggle("rm-block-ref-show", show);
  });
};

// Click away
roamsr.focusMain = () => {
  roamsr.simulateClick(document.querySelector(".roam-main"));
}

// Update the content of the main block
roamsr.changeQuestionBlockContent = async (transform) => {
  roamsr.simulateClick(document.querySelector(".rm-block-main .roam-block"));
  await roamsr.sleep();
  var txtarea = document.activeElement;
  var setValue = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    "value"
  ).set;
  setValue.call(txtarea, transform(txtarea.value));
  var e = new Event("input", { bubbles: true });
  txtarea.dispatchEvent(e);
  await roamsr.sleep();
  roamsr.focusMain();
}

// Check [[h]] tag
roamsr.checkhTag = async () => {
  // Find [[h]] pages id
  let query = window.roamAlphaAPI.q('[:find (pull ?hpage [*]) :where [?hpage :node/title "h"] [?question :block/uid "' + roamsr.prompts[roamsr.promptCounter][0].uid + '"] [?question :block/refs ?hpage]]');
  if (query.length == 0) {
    await roamsr.changeQuestionBlockContent(text => text.replace(/(\{\{\[\[∆)/g, "#h $1"));
  }
}

// --- Spaced repetition ---
// Get current interval
roamsr.getInterval = () => {
  var interval = roamsr.prompts[roamsr.promptCounter][0].string.match(roamsr.deltaRegex);
  if (interval && interval.length != 0) return parseInt(interval[0]);
  else return 0;
}

// Simplified SM2
roamsr.calculateNextInterval = (yes) => {
  let next;
  let prev = roamsr.getInterval();
  if (yes) {
    if (prev == 0) next = 1;
    else if (prev == 1) next = 6;
    else next = Math.floor(prev * roamsr.settings.easeFactor);
  } else {
    next = -1;
  }
  return next;
};

roamsr.getIntervalHumanReadable = (n) => {
  if (n == -1) return "<10 min"
  else if (n > 0 && n <= 15) return n + " d"
  else if (n <= 30) return (n / 7).toFixed(1) + " w"
  else if (n <= 365) return (n / 30).toFixed(1) + " m"
}

// --- Main functions ---

// Go to next prompt
roamsr.goToNextPrompt = async () => {
  // Bump counter
  roamsr.promptCounter += 1;

  // Update widget
  roamsr.counterWidget();

  var doStuff = async () => {
    roamsr.goToUid(roamsr.prompts[roamsr.promptCounter][0].uid);
    await roamsr.sleep();
    roamsr.showBlockRefs(false); // Cloze deletion
    roamsr.addCustomElements();
  }

  // Force redirect to next prompt - NO DISTRACTIONS!
  window.onhashchange = doStuff;

  // Go to the next prompt
  await doStuff();
};

// Do funky stuff
roamsr.clickAndGo = async (yes) => {
  window.onhashchange = async () => { };

  var doStuff = async (transform) => {
    await roamsr.changeQuestionBlockContent(transform);
    await roamsr.sleep();
    roamsr.simulateClick(document.querySelector(".rm-orbit-tag"), { shiftKey: true });
    await roamsr.sleep();
    await roamsr.checkhTag();
  }

  if (yes && roamsr.promptCounter >= roamsr.countNewPrompts) {
    await doStuff(text => text.replace(roamsr.deltaRegex, roamsr.calculateNextInterval(yes)));
  }
  else {
    if (roamsr.promptCounter < roamsr.countNewPrompts) {
      await doStuff(text => text + " {{[[∆]]:0+0}}");
      roamsr.countNewPrompts -= 1;
    }

    roamsr.prompts.push(roamsr.prompts[roamsr.promptCounter]);
    roamsr.prompts.splice(roamsr.promptCounter, 1);
    roamsr.promptCounter -= 1;
  }

  if (!roamsr.prompts[roamsr.promptCounter + 1]) {
    await roamsr.setMode(false);
  } else {
    await roamsr.goToNextPrompt();
  }
};

// Add response area
roamsr.addCustomElements = () => {
  // Find container to add elements
  var container = document.querySelector(".roam-article");

  var responseArea = Object.assign(document.createElement("div"), { className: "roamsr-response-area" });

  roamsr.addElement(responseArea, container);

  // Add "Show answer." button
  var showAnswerButton = Object.assign(document.createElement("button"), {
    id: "show-answer-button",
    innerHTML: "Show answer.",
    className: "roamsr-show-answer-button bp3-button"
  });

  roamsr.addElement(showAnswerButton, responseArea);

  // Click event on "Show answer." button
  showAnswerButton.onclick = async () => {
    // Show answer
    document.querySelector(".rm-block-children").style.display = "flex";

    showAnswerButton.remove();
    roamsr.showBlockRefs(true);

    let responses = roamsr.settings.responses;
    var yesButton = Object.assign(document.createElement("button"), {
      id: "yes-button",
      innerHTML:
        responses[2] + "<sup>" + roamsr.getIntervalHumanReadable(roamsr.calculateNextInterval(true)) + "</sup>",
      className: "roamsr-yesno-button bp3-button",
      onclick: () => { responseArea.remove(); roamsr.clickAndGo(true) }
    });

    var noButton = Object.assign(document.createElement("button"), {
      id: "no-button",
      innerHTML:
        responses[1] + "<sup>" + roamsr.getIntervalHumanReadable(roamsr.calculateNextInterval(false)) + "</sup>",
      className: "roamsr-yesno-button bp3-button",
      onclick: () => { responseArea.remove(); roamsr.clickAndGo(false) }
    });

    var justLearnedButton = Object.assign(document.createElement("button"), {
      id: "just-learned-button",
      innerHTML:
        responses[0] + "<sup>" + roamsr.getIntervalHumanReadable(roamsr.calculateNextInterval(false)) + "</sup>",
      className: "roamsr-yesno-button bp3-button",
      onclick: () => { responseArea.remove(); roamsr.clickAndGo(false) }
    });

    if (roamsr.promptCounter < roamsr.countNewPrompts) {
      roamsr.addElement(justLearnedButton, responseArea);
    } else {
      roamsr.addElement(noButton, responseArea);
      roamsr.addElement(yesButton, responseArea);
    }
  };
};

// Number of prompts in the top right
roamsr.counterWidget = () => {
  let isNew = roamsr.promptCounter < roamsr.countNewPrompts;
  let newCount = isNew ? roamsr.countNewPrompts - roamsr.promptCounter : 0;
  let reviewCount = roamsr.prompts.length - newCount - (isNew ? 0 : roamsr.promptCounter);
  let widget = Object.assign(document.createElement("div"), {
    id: "roamsr-counter-widget",
    innerHTML: ` <span style="color:blue;">` + newCount + `</span> ` + `<span style="color:green;">` + reviewCount + `</span>`,
    className: "roamsr-counter-widget"
  })
  roamsr.addElement(widget, document
    .querySelector(".roam-topbar .flex-h-box"));
}

// Start review session function
roamsr.review = async () => {
  console.log("Starting session.");

  roamsr.promptCounter = -1;

  // Reload prompts
  roamsr.loadPromptsDue();

  await roamsr.goToNextPrompt();
};

// Enable/disable stylesheet from the block referencing "roam/css" on the "roam/sr" page
roamsr.setStyle = yes => {
  let styleId = "roamsr-css";
  roamsr.removeId(styleId);

  if (yes) {
    // Query new style
    let styleQuery = window.roamAlphaAPI.q(
      `[:find (pull ?style [:block/string]) :where [?roamsr :node/title "roam\/sr"] [?roamsr :block/children ?css] [?css :block/refs ?roamcss] [?roamcss :node/title "roam\/css"] [?css :block/children ?style]]`
    );

    // Check if query was succesful
    let roamsrCSS;
    if (styleQuery && styleQuery.length != 0) {
      let style = styleQuery[0][0].string.replace("```css", "").replace("```", "");
      roamsrCSS = Object.assign(document.createElement("style"), {
        innerHTML: style
      });
    } else {
      roamsrCSS = Object.assign(document.createElement("link"), {
        href: "https://roamsr.aidam38.repl.co/default-style.css",
        rel: "stylesheet",
        type: "text/css"
      })
    }
    roamsrCSS.id = styleId;

    // Add it
    document.getElementsByTagName("head")[0].appendChild(roamsrCSS);
  }
};

// Load prompts due
roamsr.loadPromptsDue = () => {
  // Find all blocks referencing [[sr]] and [[∆]]
  let sr = roamsr.settings.srTag;
  let oldPrompts = window.roamAlphaAPI.q(
    '[:find (pull ?question [:block/uid :block/string :block/refs]) (pull ?dailyNote [:block/uid]) :where [?question :block/refs ?srPage] [?srPage :node/title "' + sr + '"] [?question :block/refs ?deltaPage] [?deltaPage :node/title "∆"] [?dailyNote :block/children ?question]]'
  );
  let newPrompts = window.roamAlphaAPI.q(
    '[:find (pull ?question [:block/uid :block/string]) :where [?question :block/refs ?srPage] [?srPage :node/title "' + sr + '"] (not-join [?question] [?question :block/refs ?deltaPage] [?deltaPage :node/title "∆"]) (not-join [?question] [?question :block/refs ?rmoved] [?rmoved :node/title "r/moved"]) (not-join [?question] [?question :block/refs ?query] [?query :node/title "query"])]');

  // Filter only for prompts on daily pages and those that are before today
  oldPrompts = oldPrompts.filter(
    prompt =>
      Date.parse(prompt[1].uid) && Date.parse(prompt[1].uid) <= new Date()
  );
  // Sort by date
  oldPrompts = oldPrompts.sort(
    (a, b) => Date.parse(a[1].uid) - Date.parse(b[1].uid)
  );

  roamsr.countNewPrompts = newPrompts.length;
  roamsr.prompts = newPrompts.concat(oldPrompts);
};

// Toggle global filter o [[h]]
roamsr.setGlobalFilter = async yes => {
  let name = "h";
  let hblock = window.roamAlphaAPI.q('[:find (pull ?hblock [:block/uid]) :where [?roamsr :block/children ?hblock] [?hblock :block/refs ?hpage] [?roamsr :node/title "roam/sr"] [?hpage :node/title "' + name + '"]]');

  if (hblock.length == 0) {
    console.log("Error! Please create a top-level block on the roam/sr page referencing [[" + name + "]].");
    return;
  }
  roamsr.goToUid(hblock[0][0].uid);

  await roamsr.sleep();
  roamsr.focusMain();

  // Helper function
  var findhButton = () => {
    let hButton;
    let filtered;
    document.querySelectorAll(".rm-line + div button, .rm-line + input + div button").forEach(button => {
      if (button.innerText == name) {
        hButton = button;
        filtered = true;
      }
      else if (button.innerText.startsWith(name + "\n")) {
        hButton = button;
        filtered = false
      }
    });
    return [hButton, filtered];
  }

  // Click the filter icon
  roamsr.simulateClick(document.querySelector(".bp3-icon-filter"));

  await roamsr.sleep();

  // Find the h button
  var [hButton, filtered] = findhButton();
  if (hButton) {
    if (yes && !filtered) {
      roamsr.simulateClick(hButton, { shiftKey: true });

      await roamsr.sleep();

      [hButton, filtered] = findhButton();
      if (hButton && filtered) {
        roamsr.simulateClick(hButton.parentNode.previousSibling.firstChild.firstChild.firstChild.firstChild)
      }
    } else if (!yes && filtered) {
      roamsr.simulateClick(hButton);
    }
  }
  await roamsr.sleep();
  roamsr.focusMain();
}

// Enable/disable SR mode
roamsr.setMode = async mode => {
  roamsr.mode = mode;

  if (roamsr.mode) {
    roamsr.setStyle(true);
    await roamsr.setGlobalFilter(false);
    await roamsr.review();
  } else {
    window.onhashchange = () => { };
    await roamsr.setGlobalFilter(true);
    roamsr.goToUid();
    roamsr.removeId("roamsr-counter-widget");
    roamsr.setStyle(false);
    console.log("Ending session.");
  }
};

// -----------------------------------------------
// --- Loading prompts & counting their number ---
// ------ calling functions directly here! -------
// -----------------------------------------------

roamsr.loadPromptsDue();
console.log("SR prompts due: " + roamsr.prompts.length);

// Adding buttons to the topbar
var toggleModeButton = Object.assign(document.createElement("div"), {
  id: "roamsr-review-button",
  className: "bp3-button bp3-minimal bp3-small",
  innerHTML:
    `<svg width="16" height="16" version="1.1" viewBox="0 0 4.2333 4.2333" style="color:5c7080;">
			<g id="chat_1_" transform="matrix(.26458 0 0 .26458 115.06 79.526)">
				<g transform="matrix(-.79341 0 0 -.88644 -420.51 -284.7)" fill="currentColor">
					<path d="m6 13.665c-1.1 0-2-1.2299-2-2.7331v-6.8327h-3c-0.55 0-1 0.61495-1 1.3665v10.932c0 0.7516 0.45 1.3665 1 1.3665h9c0.55 0 1-0.61495 1-1.3665l-5.04e-4 -1.5989v-1.1342h-0.8295zm9-13.665h-9c-0.55 0-1 0.61495-1 1.3665v9.5658c0 0.7516 0.45 1.3665 1 1.3665h9c0.55 0 1-0.61495 1-1.3665v-9.5658c0-0.7516-0.45-1.3665-1-1.3665z"
					 clip-rule="evenodd" fill="currentColor" fill-rule="evenodd" />
				</g>
			</g>
		</svg>`,
  onclick: async () => {
    roamsr.loadPromptsDue();
    if (roamsr.prompts.length !== 0) {
      await roamsr.setMode(!roamsr.mode)
    }
  }
});
toggleModeButton.style.cssText = "height: 24px; width: 24px; cursor: pointer; display: grid; place-content: center; gap: 1ch;";

roamsr.addElement(toggleModeButton, document
  .querySelector(".roam-topbar .flex-h-box"));

// Make Alt+D leave review mode
document.addEventListener("keydown", ev => {
  if (ev.code == "KeyD" && ev.altKey == true && roamsr.mode) {
    roamsr.setMode(!roamsr.mode);
  }
})