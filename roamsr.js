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

  // Sleep promis
  roamsr.sleep = m => new Promise(r => setTimeout(r, m));

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
      '[:find (pull ?question [:block/uid :block/string]) (pull ?dailyNote [:block/uid]) :where [?question :block/refs ?srPage] [?srPage :node/title "sr"] [?question :block/refs ?deltaPage] [?deltaPage :node/title "∆"] [?dailyNote :block/children ?question]]'
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

  // --- Main functions ---

  // Delta workaround for SM2
  roamsr.calculateNextInterval = yes => {
    var easeFactor = 2.5;
    const content = roamsr.prompts[roamsr.promptCounter - 1][0].string;
    var prevInterval = parseInt(content.match(/[0-9]+(?=\+0\}\})/g));
    console.log(prevInterval);
    var nextInterval = 1;
    if (yes) {
      if (prevInterval == 0) nextInterval = 1;
      else if (prevInterval == 1) nextInterval = 6;
      else nextInterval = prevInterval * easeFactor;
    } else nextInterval = 1;
    return Math.floor(nextInterval);
  };
  roamsr.clickAndGo = async (time, yes) => {
    window.onhashchange = async () => { }
    var question = document.querySelector(".rm-zoom-item:nth-child(2)");
    var delta = document.querySelector("[data-tag='sr'] + span");
    roamsr.simulateClick(question, ["mousedown", "click", "mouseup"], true);
    await roamsr.sleep(time);

    var txtarea = document.activeElement;
    var newValue = txtarea.value.replace(
      /[0-9]+(?=\+0\}\})/g,
      roamsr.calculateNextInterval(yes)
    );
    //.replace("#sr {{[[∆]]:1+0}} {{[[∆]]:1*2}}", "pog");
    var setValue = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value"
    ).set;
    setValue.call(txtarea, newValue);
    var e = new Event("input", { bubbles: true });
    txtarea.dispatchEvent(e);

    await roamsr.sleep(time);

    roamsr.simulateClick(
      document.querySelector(".roam-main"),
      ["mousedown", "click", "mouseup"],
      true
    );
    await roamsr.sleep(time);

    delta = document.querySelector("[data-tag='sr'] + span");

    roamsr.simulateClick(delta, ["mousedown", "click", "mouseup"], true, {
      shiftKey: true
    });

    await roamsr.sleep(time);

    roamsr.goToNextPrompt();
  };

  // Go to next prompt
  roamsr.goToNextPrompt = () => {
    // Check if there are more prompts
    if (!roamsr.prompts[roamsr.promptCounter - 1 + 1]) {
      // If there are no new prompts, end session
      roamsr.setMode(false);
    } else {
      // Bump counter
      roamsr.promptCounter += 1;

      // Define uid
      const uid = roamsr.prompts[roamsr.promptCounter - 1][0].uid;
      // Pull answer
      var answer = window.roamAlphaAPI.q(
        '[:find (pull ?answer [:block/uid :block/string]) :where [?question :block/children ?answer] [?question :block/uid "' +
        uid +
        '"]]'
      );

      // Check if there's no answer
      if (answer[0]) {
        answer = answer[0][0];
      } else {
        answer = {};
        answer.uid = "";
        answer.string = "(No answer.)";
      }

      // Create new url
      const nextPromptUrl = roamsr.baseUrl().hash + "/page/" + uid;

      // Force redirect to current prompt
      window.onhashchange = async () => {
        // Jump back, no distractions bitch!
        location.assign("/" + nextPromptUrl);
        // Wait for page to load (100 ms)
        await roamsr.sleep(100);
        // Hide Delta
        roamsr.showDelta(false);
        roamsr.showBlockRefs(false);

        roamsr.addCustomElements(answer);
      };

      // Jump to next url
      console.log("Jumping to next prompt: " + nextPromptUrl);
      location.assign("/" + nextPromptUrl);
    }
  };

  roamsr.addCustomElements = answer => {
    // Find container to add elements
    var container = document.querySelector(".roam-article");

    // Define "Show answer." button
    var showAnswerButton = document.createElement("button");
    showAnswerButton.id = "show-answer-button";
    showAnswerButton.innerHTML = "Show answer.";
    showAnswerButton.classList.add("roamsr-show-answer-button", "bp3-button");

    // Add both
    const prevShowAnswerButton = document.getElementById(showAnswerButton.id);
    if (prevShowAnswerButton) container.removeChild(prevShowAnswerButton);
    container.appendChild(showAnswerButton);

    // Click event on "Show answer." button
    showAnswerButton.onclick = async () => {
      const answerUrl = roamsr.baseUrl().hash + "/page/" + answer.uid;
      location.assign("/" + answerUrl);
      window.onhashchange = async () => {
        location.assign("/" + answerUrl);
      }
      await roamsr.sleep(50);


      showAnswerButton.hidden = true;

      // Show clozes
      roamsr.showBlockRefs(true);

      var responseArea = document.createElement("div");
      responseArea.classList.add("roamsr-response-area");
      var yesButton = document.createElement("button");
      yesButton.id = "yes-button";
      yesButton.innerHTML =
        "Remembered.<sup>" + roamsr.calculateNextInterval(true) + "d</sup>";
      yesButton.classList.add("roamsr-yesno-button", "bp3-button");
      yesButton.onclick = () => roamsr.clickAndGo(500, true);

      var noButton = document.createElement("button");
      noButton.id = "no-button";
      noButton.innerHTML =
        "Forgotten.<sup>" + roamsr.calculateNextInterval(false) + "d</sup>";
      noButton.classList.add("roamsr-yesno-button", "bp3-button");
      noButton.onclick = () => roamsr.clickAndGo(500, false);

      responseArea.appendChild(noButton);
      responseArea.appendChild(yesButton);

      container.appendChild(responseArea);
    };
  };

  roamsr.showAnswer = () => { };

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
      window.onhashchange = () => { };
      location.assign("/" + roamsr.baseUrl().hash);

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

  // Remove past buttons
  var prevReview = document.querySelector("#roamsr-review-button");
  var prevRefresh = document.querySelector("#roamsr-refresh-button");
  if (prevReview) {
    prevReview.remove();
  }
  if (prevRefresh) {
    prevRefresh.remove();
  }

  // Adding toggle button on the top right
  roamsr.toggleModeButton = document.createElement("div");
  roamsr.toggleModeButton.id = "roamsr-review-button";
  roamsr.toggleModeButton.className = "bp3-button bp3-minimal bp3-small";
  roamsr.toggleModeButton.style.color = "#5c7080";
  roamsr.toggleModeButton.innerHTML =
    "<img src='https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fnotemap%2F1TUIZqQWcJ.svg?alt=media&token=a624be01-967e-43ce-8688-0b50d898b428'>";
  roamsr.toggleModeButton.setAttribute("style", "position:relative;left:2px");
  roamsr.toggleModeButton.onclick = () => roamsr.setMode(!roamsr.mode);

  document
    .querySelector(".roam-topbar .flex-h-box")
    .appendChild(roamsr.toggleModeButton);

  var refreshButton = document.createElement("div");
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
  console.log("...and got to the end!");
})();
