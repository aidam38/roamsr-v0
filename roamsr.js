() => { };

(() => {
  console.log("Successfully (re)loaded roam-sr.js...");

  window.roamsr = {};

  // -----------------------
  // --- Testing routine ---
  // ------------------------
  roamsr.scriptUrl = document.currentScript.src;
  roamsr.scriptId = "roamsr-script";
  roamsr.addScriptToPage = () => {
    document.getElementsByTagName("head")[0].appendChild(
      Object.assign(document.createElement("script"), {
        src: roamsr.scriptUrl
      }),
      roamsr.scriptId,
      "text/javascript"
    );
  };
  roamsr.testingReload = () => {
    try {
      document.querySelector("#roamsr-review-button").remove();
      document.querySelector("#roamsr-refresh-button").remove();
      document.removeEventListener("keydown", roamsr.handleKeyEvent);
      const existingRoamSR = document.getElementById(roamsr.scriptId);
      if (existingRoamSR)
        document.getElementsByTagName("head")[0].removeChild(existingRoamSR);
    } catch (e) { }
    roamsr.mode = false;
    roamsr.addScriptToPage();
  };

  // --------------
  // --- Review ---
  // --------------

  // --- Settings ---
  roamsr.time = 200;
  roamsr.easeFactor = 2.5;

  // --- Variables ---
  roamsr.prompts = {};
  roamsr.promptCounter = -1;
  roamsr.mode = false;
  roamsr.styleID = "roamsrCSS";
  roamsr.baseUrl = () => {
    const url = new URL(window.location.href);
    const parts = url.hash.split("/");
    url.hash = parts.slice(0, 3).join("/");
    return url;
  };
  roamsr.regex = /[0-9]+(?=\+0\}\})/g;


  // --- Helper functions ---

  // Sleep promise
  roamsr.sleep = m => new Promise(r => setTimeout(r, m));

  // Add element to target
  roamsr.addElement = (element, target) => {
    const prevElement = document.getElementById(element.id);
    if (prevElement)
      target.removeChild(prevElement);
    target.appendChild(element);
  }

  // Cloze deletion
  roamsr.showBlockRefs = show => {
    document.querySelectorAll(".rm-block-ref").forEach(blockref => {
      blockref.classList.toggle("rm-block-ref-show", show);
    });
  };

  // Enable/disable stylesheet from the block referencing "roam/css" on the "roam/sr" page
  roamsr.setStyle = mode => {
    var style = window.roamAlphaAPI.q(
      `[:find (pull ?style [:block/string]) :where [?roamsr :node/title "roam\/sr"] [?roamsr :block/children ?css] [?css :block/refs ?roamcss] [?roamcss :node/title "roam\/css"] [?css :block/children ?style]]`
    )[0][0].string;
    style = style.replace("```css", "").replace("```", "");

    var roamsrCSS = document.createElement("style");
    roamsrCSS.id = roamsr.styleID;
    roamsrCSS.innerHTML = style;

    const prevStyle = document.getElementById(roamsr.styleID);
    if (prevStyle) {
      document.getElementsByTagName("head")[0].removeChild(prevStyle);
    }
    if (mode) {
      document.getElementsByTagName("head")[0].appendChild(roamsrCSS);
    }
  };

  // Load prompts due
  roamsr.loadPromptsDue = () => {
    // Find all blocks referencing [[sr]] and [[∆]]
    roamsr.oldPrompts = window.roamAlphaAPI.q(
      '[:find (pull ?question [:block/uid :block/string]) (pull ?dailyNote [:block/uid]) :where [?question :block/refs ?srPage] [?srPage :node/title "sr"] [?question :block/refs ?deltaPage] [?deltaPage :node/title "∆"] [?dailyNote :block/children ?question]]'
    );
    roamsr.newPrompts = window.roamAlphaAPI.q(
      '[:find (pull ?question [:block/uid :block/string]) :where [?question :block/refs ?srPage] [?srPage :node/title "sr"] (not-join [?question] [?question :block/refs ?deltaPage] [?deltaPage :node/title "∆"]) (not-join [?question] [?question :block/refs ?rmoved] [?rmoved :node/title "r/moved"]) (not-join [?question] [?question :block/refs ?query] [?query :node/title "query"])]');

    // Filter only for prompts on daily pages and those that are before today
    roamsr.oldPrompts = roamsr.oldPrompts.filter(
      prompt =>
        Date.parse(prompt[1].uid) && Date.parse(prompt[1].uid) <= new Date()
    );
    // Sort by date
    roamsr.oldPrompts = roamsr.oldPrompts.sort(
      (a, b) => Date.parse(a[1].uid) - Date.parse(b[1].uid)
    );

    roamsr.prompts = roamsr.newPrompts.concat(roamsr.oldPrompts).concat(roamsr.newPrompts);
  };

  // simulateClick by by Viktor Tabori
  roamsr.simulateClick = (element, events, leftButton, opts) => {
    setTimeout(function () {
      events.forEach(function (type) {
        var _event = new MouseEvent(type, {
          view: window,
          bubbles: true,
          cancelable: true,
          buttons: leftButton ? 1 : 2,
          ...opts
        });
        _event.simulated = true;
        element.dispatchEvent(_event);
      });
    }, 0);
  };

  roamsr.getInterval = () => {
    return roamsr.prompts[roamsr.promptCounter][0].string.match(roamsr.regex);
  }

  // --- Main functions ---

  // Delta workaround for SM2
  roamsr.calculateNextInterval = yes => {
    var nextInterval;
    var prev = roamsr.getInterval();

    if (prev && yes) {
      if (prev == 0) nextInterval = [1, "d"];
      else if (prev == 1) nextInterval = [6, "d"];
      else nextInterval = [Math.floor(prev * roamsr.easeFactor), "d"];
    } else  {
      nextInterval = [10, "min"];
    }

    return nextInterval;
  };

  roamsr.clickAndGo = async (yes) => {
    window.onhashchange = async () => { }

    if (yes) {
      // Click into main block
      var question = document.querySelector(".rm-block-main .roam-block");
      roamsr.simulateClick(question, ["mousedown", "click", "mouseup"], true);

      await roamsr.sleep(roamsr.time);

      // Update delta value
      var txtarea = document.activeElement;

      var newValue;
      if (roamsr.getInterval()) {
        newValue = txtarea.value.replace(roamsr.regex, roamsr.calculateNextInterval(yes)[0]);
      } else {
        newValue = txtarea.value + " {{[[∆]]:0+0}}"
      }

      var setValue = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value"
      ).set;
      setValue.call(txtarea, newValue);
      var e = new Event("input", { bubbles: true });
      txtarea.dispatchEvent(e);

      await roamsr.sleep(roamsr.time);

      // Click away
      roamsr.simulateClick(
        document.querySelector(".roam-main"),
        ["mousedown", "click", "mouseup"],
        true
      );

      await roamsr.sleep(roamsr.time);

      // Click delta
      var delta = document.querySelector("[data-tag='sr'] + span");
      roamsr.simulateClick(delta, ["mousedown", "click", "mouseup"], true, {
        shiftKey: true
      });

      await roamsr.sleep(roamsr.time);
    }
    else {
      roamsr.prompts.push(roamsr.prompts[roamsr.promptCounter]);
      roamsr.prompts.shift();
    }

    roamsr.goToNextPrompt();
  };

  // Go to next prompt
  roamsr.goToNextPrompt = () => {
    // Check if there are more prompts
    if (!roamsr.prompts[roamsr.promptCounter + 1]) {
      roamsr.setMode(false);
    } else {
      // Bump counter
      roamsr.promptCounter += 1;

      // Update widget
      roamsr.counterWidget();

      // Create new url
      const nextPromptUrl = roamsr.baseUrl().hash + "/page/" + roamsr.prompts[roamsr.promptCounter][0].uid;

      // Force redirect to next prompt
      window.onhashchange = async () => {
        location.assign("/" + nextPromptUrl); // Jump back, no distractions bitch!
        await roamsr.sleep(100);
        roamsr.showBlockRefs(false); // Cloze deletion
        roamsr.addCustomElements();

        // Hide answer
        document.querySelector(".rm-block-children").style.display = "none";
      };

      // Go to the next prompt
      console.log("Jumping to next prompt: " + nextPromptUrl);
      location.assign("/" + nextPromptUrl);
    }
  };

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
      showAnswerButton.hidden = true;

      // Show clozes
      roamsr.showBlockRefs(true);

      var nextInterval = (yes) => { return roamsr.calculateNextInterval(yes)[0] + " " + roamsr.calculateNextInterval(yes)[1] };

      var yesButton = Object.assign(document.createElement("button"), {
        id: "yes-button",
        innerHTML:
          "Remembered.<sup>" + nextInterval(true) + "</sup>",
        className: "roamsr-yesno-button bp3-button",
        onclick: () => { container.removeChild(responseArea); roamsr.clickAndGo(true) }
      });

      var noButton = Object.assign(document.createElement("button"), {
        id: "no-button",
        innerHTML:
          "Forgotten.<sup>" + nextInterval(false) + "</sup>",
        className: "roamsr-yesno-button bp3-button",
        onclick: () => { container.removeChild(responseArea); roamsr.clickAndGo(false) }
      });

      var justLearnedButton = Object.assign(document.createElement("button"), {
        id: "just-learned-button",
        innerHTML:
          "Just learned.<sup>" + nextInterval(true) + "</sup>",
        className: "roamsr-yesno-button bp3-button",
        onclick: () => { container.removeChild(responseArea); roamsr.clickAndGo(true) }
      });

      responseArea.removeChild(showAnswerButton);

      if (roamsr.getInterval()) {
        roamsr.addElement(noButton, responseArea);
        roamsr.addElement(yesButton, responseArea);
      } else {
        roamsr.addElement(justLearnedButton, responseArea);
      }
    };
  };
  
  roamsr.counterWidget = () => {
    var widget = Object.assign(document.createElement("div"), {
      id: "roamsr-counter-widget",
      innerHTML: (roamsr.promptCounter + 1) + " / " + roamsr.prompts.length,
      className: "roamsr-counter-widget"
    })
    roamsr.addElement(widget, topbar);
  }

  // Start review session function
  roamsr.review = () => {
    console.log("Starting session.");

    roamsr.promptCounter = -1;

    // Reload prompts
    roamsr.loadPromptsDue();

    roamsr.goToNextPrompt();
  };

  // Enable/disable SR mode
  roamsr.setMode = mode => {
    roamsr.mode = mode;
    roamsr.loadPromptsDue();
    console.log("SR prompts due: " + roamsr.prompts.length);

    if (roamsr.mode) {
      // Add custom css
      roamsr.setStyle(true);

      // Starting review
      roamsr.review();
    } else {
      // Going home
      window.onhashchange = () => { };
      location.assign("/" + roamsr.baseUrl().hash);

      topbar.removeChild(document.getElementById("roamsr-counter-widget"));
      
      roamsr.setStyle(false);

      console.log("Ending session.");
    }
  };

  // -----------------------------------------------
  // --- Loading prompts & counting their number --- (calling functions directly here!)
  // -----------------------------------------------
  roamsr.loadPromptsDue();
  console.log("SR prompts due: " + roamsr.prompts.length);

  // --- Visual elements ---

  var topbar = document
    .querySelector(".roam-topbar .flex-h-box");

  // Adding toggle button on the top right
  var toggleModeButton = Object.assign(document.createElement("div"), {
    id: "roamsr-review-button",
    className: "bp3-button bp3-minimal bp3-small",
    style: {
      cssText: "color: #5c7080; position:relative; left:2px"
    },
    innerHTML:
      "<img src='https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fnotemap%2F1TUIZqQWcJ.svg?alt=media&token=a624be01-967e-43ce-8688-0b50d898b428'>",
    onclick: () => roamsr.setMode(!roamsr.mode)
  });

  var refreshButton = Object.assign(document.createElement("div"), {
    id: "roamsr-refresh-button",
    className: "bp3-button bp3-minimal bp3-small bp3-icon-refresh",
    style: {
      cssText: "position:relative; left:2px"
    },
    onclick: roamsr.testingReload
  });

  roamsr.addElement(toggleModeButton, topbar);
  roamsr.addElement(refreshButton, topbar);

  console.log("...and got to the end!");
})();



// Unused / old functions


// ---------------------
// --- Card creation ---
// ---------------------


// Replace delta with SR widget function
roamsr.replaceDelta = () => {
  setTimeout(() => {
    var txtarea = document.activeElement;
    var newValue = txtarea.value
      .replace("{{[[∆]]:1+2}}", "")
      .concat("#sr {{[[∆]]:0+0}}");
    var setValue = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value"
    ).set;
    setValue.call(txtarea, newValue);
    var e = new Event("input", { bubbles: true });
    txtarea.dispatchEvent(e);
  }, 50);
};

roamsr.handleKeyEvent = ev => {
  // console.log("alt: " + ev.altKey + "  shift: " + ev.shiftKey + "  ctrl: " + ev.ctrlKey + "   code: " + ev.code);
  // Alt+S keybinding
  if (ev.altKey && ev.shiftKey && ev.code == "KeyS") {
    ev.preventDefault();
    roamsr.replaceDelta();
    return;
  }
  // Alt+d to end session
  if (ev.altKey && !ev.shiftKey && ev.code == "KeyD" && roamsr.mode) {
    roamsr.setMode(false);
  }
};

// Add keybindings
document.addEventListener("keydown", roamsr.handleKeyEvent);


// Show/hide delta buttons
roamsr.showDelta = show => {
  document
    .querySelectorAll(".rm-orbit-tag")
    .forEach(delta => (delta.style.visibility = show ? "visible" : "hidden"));
};