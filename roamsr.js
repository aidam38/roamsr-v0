() => {};

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
    } catch (e) {}
    roamsr.mode = false;
    roamsr.addScriptToPage();
  };

  // --------------
  // --- Review ---
  // --------------

  // --- Variables ---

  roamsr.prompts = {};
  roamsr.promptCounter = 0;
  roamsr.mode = false;
  roamsr.styleID = "roamsrCSS";
  roamsr.baseUrl = () => {
    const url = new URL(window.location.href);
    const parts = url.hash.split("/");
    url.hash = parts.slice(0, 3).join("/");
    return url;
  };

  // --- Helper functions ---

  // Show/hide delta buttons
  roamsr.showDelta = show => {
    document
      .querySelectorAll(".rm-orbit-tag")
      .forEach(delta => (delta.style.visibility = show ? "visible" : "hidden"));
  };
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
    roamsr.prompts = window.roamAlphaAPI.q(
      '[:find (pull ?question [:block/uid]) (pull ?dailyNote [:block/uid]) :where [?question :block/refs ?srPage] [?srPage :node/title "sr"] [?question :block/refs ?deltaPage] [?deltaPage :node/title "∆"] [?dailyNote :block/children ?question]]'
    );
    // Filter only for prompts on daily pages and those that are before today
    roamsr.prompts = roamsr.prompts.filter(
      prompt =>
        Date.parse(prompt[1].uid) && Date.parse(prompt[1].uid) <= new Date()
    );
    // Sort by date
    roamsr.prompts = roamsr.prompts.sort(
      (a, b) => Date.parse(a[1].uid) - Date.parse(b[1].uid)
    );
  };

  // Redirect all clicks on Delta to shift clicks

  // simulateClick by by Viktor Tabori
  roamsr.simulateClick = (element, events, leftButton, opts) => {
    setTimeout(function() {
      events.forEach(function(type) {
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
  roamsr.addClickListenerToDelta = () => {
    // Query all deltas on page
    document.querySelectorAll(".rm-orbit-tag").forEach(delta => {
      delta.addEventListener(
        "mousedown",
        ev => {
          console.log("registered mouse event!");
          ev.stopPropagation();
          ev.preventDefault();
          if (!ev.shiftKey) {
            roamsr.simulateClick(
              delta,
              ["mousedown", "click", "mouseup"],
              true,
              {
                shiftKey: true
              }
            );
            setTimeout(roamsr.goToNextPrompt, 20);
          }
        },
        true
      );
      // Suppress click event
      delta.addEventListener(
        "click",
        ev => {
          console.log("registered click event! with shift? " + ev.shiftKey);
          if (!ev.shiftKey) {
            ev.stopPropagation();
            ev.preventDefault();
          }
        },
        true
      );
    });
  };

  // --- Main functions ---

  // Go to next prompt
  roamsr.goToNextPrompt = () => {
    // Check if there are more prompts
    if (roamsr.prompts[roamsr.promptCounter - 1 + 1]) {
      // Bump counter
      roamsr.promptCounter += 1;
      // Update counter element
      roamsr.toggleModeButton.innerHTML =
        roamsr.promptCounter + "/" + roamsr.prompts.length;

      // Define uid
      const uid = roamsr.prompts[roamsr.promptCounter - 1][0].uid;
      // Pull answer
      var answer = window.roamAlphaAPI.q(
        '[:find (pull ?answer [:block/uid :block/string]) :where [?question :block/children ?answer] [?question :block/uid "' +
          uid +
          '"]]'
      )[0][0];

      // Create new url
      const nextPromptUrl = roamsr.baseUrl().hash + "/page/" + uid;

      // Jump to next url
      console.log("Jumping to next prompt: " + nextPromptUrl);
      location.assign("/" + nextPromptUrl);

      // Force redirect to current prompt
      window.onhashchange = () => {
        // Jump back, no distractions bitch!
        location.assign("/" + nextPromptUrl);

        // Wait for page to load (100 ms)
        setTimeout(() => {
          // Hide Delta
          roamsr.showDelta(false);
          roamsr.showBlockRefs(false);

          // If there's no answer, assign default text
          if (!answer) answer.string = "No nested blocks.";

          // Find container to add elements
          var container = document.querySelector(".roam-block-container");

          // Define "Show answer." button
          var showAnswerButton = document.createElement("button");
          showAnswerButton.id = "show-answer-button";
          showAnswerButton.innerHTML = "Show answer.";
          showAnswerButton.classList.add("roamsr-show-answer-button");

          // Define answer area
          var answerArea = document.createElement("div");
          answerArea.id = "answer-area";
          answerArea.innerHTML = answer.string;
          answerArea.hidden = true;
          answerArea.classList.add("roamsr-show-answer-button");

          // Add both
          const prevShowAnswerButton = document.getElementById(
            showAnswerButton.id
          );
          if (prevShowAnswerButton) container.removeChild(prevShowAnswerButton);
          container.appendChild(showAnswerButton);

          const prevAnswerArea = document.getElementById(answerArea.id);
          if (prevAnswerArea) container.removeChild(prevAnswerArea);
          container.appendChild(answerArea);

          // Click event on "Show answer." button
          showAnswerButton.onclick = () => {
            // xxx old redirect to answer block
            //window.onhashchange = () => {};
            //location.assign(
            //"/" + roamsr.baseUrl().hash + "/page/" + answer.uid
            //);
            // Hide "Show answer."
            showAnswerButton.hidden = true;
            // Show answer
            answerArea.hidden = false;

            // Show delta
            roamsr.showDelta(true);
            roamsr.showBlockRefs(true);
            // Make Delta go to next prompt
            roamsr.addClickListenerToDelta();
          };
        }, 100);
      };
    } else {
      // If there are no new prompts, end session
      roamsr.setMode(false);
    }
  };

  // Start review session function
  roamsr.review = () => {
    console.log("Starting session.");

    roamsr.promptCounter = 0;

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
      window.onhashchange = () => {};
      location.assign("/" + roamsr.baseUrl().hash);

      roamsr.setStyle(false);

      console.log("Ending session.");
    }
  };

  // --- Loading prompts & counting their number --- (calling functions directly here!)
  roamsr.loadPromptsDue();
  console.log("SR prompts due: " + roamsr.prompts.length);

  // --- Visual elements ---

  // Adding toggle button on the top right
  roamsr.toggleModeButton = document.createElement("button");
  roamsr.toggleModeButton.id = "roamsr-review-button";
  roamsr.toggleModeButton.className =
    "bp3-button bp3-minimal bp3-small bp3-icon-repeat";
  roamsr.toggleModeButton.innerHTML = roamsr.prompts.length;
  roamsr.toggleModeButton.setAttribute("style", "position:relative;left:2px");
  roamsr.toggleModeButton.onclick = () => roamsr.setMode(!roamsr.mode);

  document
    .querySelector(".roam-topbar .flex-h-box")
    .appendChild(roamsr.toggleModeButton);

  var refreshButton = document.createElement("button");
  refreshButton.id = "roamsr-refresh-button";
  refreshButton.className = "bp3-button bp3-minimal bp3-small bp3-icon-refresh";
  refreshButton.setAttribute("style", "position:relative;left:2px");
  refreshButton.onclick = roamsr.testingReload;

  document.querySelector(".roam-topbar .flex-h-box").appendChild(refreshButton);

  // ---------------------
  // --- Card creation ---
  // ---------------------

  // Replace delta with SR widget function
  roamsr.replaceDelta = () => {
    setTimeout(() => {
      var txtarea = document.activeElement;
      var newValue = txtarea.value
        .replace("{{[[∆]]:1+2}}", "")
        .concat("#[[[[sr]]:n]] {{[[∆]]:1+0}} #[[[[sr]]:y]] {{[[∆]]:1*2}}");
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
    if (ev.altKey && !ev.shiftKey && ev.code == "KeyD" && mode) {
      roamsr.setMode(false);
    }
  };

  // Add keybindings
  document.addEventListener("keydown", roamsr.handleKeyEvent);
  console.log("...and got to the end!");
})();
