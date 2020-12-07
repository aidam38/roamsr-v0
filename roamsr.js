() => {};

(() => {
  console.log("Successfully (re)loaded roam-sr.js");

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
      document.querySelector("#roamsr-css-button").remove();
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
  roamsr.promptCounter = 1;
  roamsr.mode = false;
  roamsr.styleID = "roamsrCSS";
  roamsr.baseUrl = () => {
    const url = new URL(window.location.href);
    const parts = url.hash.split("/");
    url.hash = parts.slice(0, 3).join("/");
    return url;
  };

  // --- Helper functions ---

  // --- Redirecting all clicks on Delta to shift clicks ---

  // by Viktor Tabori
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
            roamsr.prompts.shift();
            roamsr.toggleModeButton.innerHTML = roamsr.prompts.length;
            setTimeout(roamsr.goToNextPrompt, 400);
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

  // Show/hide delta buttons
  roamsr.showDelta = show => {
    if (show) {
      document
        .querySelectorAll(".rm-orbit-tag")
        .forEach(delta => (delta.style.cssText = "display: inline !important"));
    } else {
      document
        .querySelectorAll(".rm-orbit-tag")
        .forEach(delta => (delta.style.cssText = "display: none !important"));
    }
  };

  // Add/remove style from the bullet referencing "roam/css" on the "RoamSR" page
  roamsr.setStyle = mode => {
    var style = window.roamAlphaAPI.q(
      `[:find (pull ?style [:block/string]) :where [?roamsr :node/title "RoamSR"] [?roamsr :block/children ?css] [?css :block/refs ?roamcss] [?roamcss :node/title "roam\/css"] [?css :block/children ?style]]`
    )[0][0].string;
    style = style.replace("```css", "").replace("```", "");

    var roamsrCSS = document.createElement("style");
    roamsrCSS.id = roamsr.styleID;
    roamsrCSS.innerHTML = style;

    const prevStyle = document.getElementById(roamsr.styleID);
    if (prevStyle)
      document.getElementsByTagName("head")[0].removeChild(prevStyle);
    if (mode) document.getElementsByTagName("head")[0].appendChild(roamsrCSS);
  };

  // Load prompts due
  roamsr.loadPromptsDue = () => {
    // Find all blocks referencing [[sr]] and [[∆]]
    roamsr.prompts = window.roamAlphaAPI.q(
      `[:find (pull ?question [:block/uid]) (pull ?dailyNote [:block/uid]) :where [?question :block/refs ?srPage] [?srPage :node/title "sr"] [?question :block/refs ?deltaPage] [?deltaPage :node/title "∆"] [?dailyNote :block/children ?question]]`
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

  // --- Main functions ---

  // Go to next prompt
  roamsr.goToNextPrompt = () => {
    // Check if there are more prompts
    if (roamsr.prompts[0]) {
      // define uid
      const uid = roamsr.prompts[0][0].uid;
      // Create new url
      const nextPromptUrl = roamsr.baseUrl().hash + "/page/" + uid;

      // Jump to next url
      while (new URL(location.href).hash != nextPromptUrl) {
        console.log("Jumping to next prompt: " + nextPromptUrl);
        location.assign("/" + nextPromptUrl);
      }

      // Pull answer
      var answer = window.roamAlphaAPI.q(
        '[:find (pull ?answer [:block/uid]) :where [?question :block/children ?answer] [?question :block/uid "' +
          uid +
          '"]]'
      )[0][0];

      // Bump counter
      roamsr.promptCounter += 1;
      setTimeout(() => {
        // Hide Delta
        roamsr.showDelta(false);

        // Add "Show answer." button
        var container = document.querySelector(".roam-block-container");
        var showAnswerButton = document.createElement("button");

        // ... only if there's answer
        if (answer) {
          showAnswerButton.innerHTML = "Show answer.";
          showAnswerButton.classList.add("roamsr-show-answer");

          showAnswerButton.onclick = () => {
            location.href = roamsr.baseUrl().href + "/page/" + answer.uid;
            setTimeout(() => {
              // Show delta
              roamsr.showDelta(true);
              // Make Delta go to next prompt
              roamsr.addClickListenerToDelta();
            }, 50);
          };
          // If there's no answer, just show Delta directly
        } else {
          showAnswerButton.innerHTML = "There are no blocks under this prompt.";
          roamsr.showDelta(true);
          roamsr.addClickListenerToDelta();
        }
        container.appendChild(showAnswerButton);
      }, 100);
    } else {
      // If there are no new prompts, end session
      roamsr.toggleMode();
    }
  };

  // Start review session function
  roamsr.review = () => {
    console.log("Starting session.");

    roamsr.promptCounter = 1;

    // Reload prompts
    roamsr.loadPromptsDue();

    roamsr.goToNextPrompt();
  };

  // Enable/disable SR mode
  roamsr.toggleMode = () => {
    roamsr.mode = !roamsr.mode;
    roamsr.loadPromptsDue();
    console.log("SR prompts due: " + roamsr.prompts.length);

    if (roamsr.mode) {
      // Add custom css
      roamsr.setStyle(true);

      // Starting review
      roamsr.review();
    } else {
      // Remove custom css
      roamsr.setStyle(false);

      console.log("Ending session. Going to " + roamsr.baseUrl());
      location.href = roamsr.baseUrl();
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
  roamsr.toggleModeButton.onclick = roamsr.toggleMode;

  document
    .querySelector(".roam-topbar .flex-h-box")
    .appendChild(roamsr.toggleModeButton);

  var cssButton = document.createElement("button");
  cssButton.id = "roamsr-css-button";
  cssButton.className = "bp3-button bp3-minimal bp3-small bp3-icon-refresh";
  cssButton.setAttribute("style", "position:relative;left:2px");
  cssButton.onclick = roamsr.testingReload;

  document.querySelector(".roam-topbar .flex-h-box").appendChild(cssButton);

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
    // console.log('alt: ' + ev.altKey  + '  shift: ' + ev.shiftKey + '  ctrl: ' + ev.ctrlKey + '   code: ' + ev.code)
    if (ev.altKey && !ev.shiftKey && ev.code == "KeyS") {
      ev.preventDefault();
      roamsr.replaceDelta();
      return;
    }
  };

  // Add Alt+S keybinding
  document.addEventListener("keydown", roamsr.handleKeyEvent);
})();