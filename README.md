# roam/sr - Spaced Repetition for Roam Research

The aim of this project is to provide **Anki-level** spaced repetition functionality in Roam **natively**. 

## The features of Roam that allow this
* **Delta**. 
  * You can have more of them in one block, like "{{[[∆]]:1+0}} {{[[∆]]:1*3}}" The function exp(3) approximates most SR algorithms well enough. Having float numbers would be even better.
  * Combined with some other tag, like [[sr]] (to not restrict Delta for SR exclusively), when you query for [[∆]] and [[sr]], that's basically your whole flashcard database. You can also use tags for multiple decks (though most serious SR users advocate for one big deck).
  * Every block managed by Delta has a history in its linked references (good thing that the uid of the "tip" still stays the same). So, you can query for all "tips" / active flashcards, query their history (in their linked references), and build fancy graphs for every cards, or for your whole database, including forecasts.
* **Global filters**
  * Globally filtering out [[sr]] prevents the cards from cluttering your daily notes. When managing your flashcard database, you can temporarily disable it. 
* **Template engines**
  * Using a subset of current template engines (Roam42, Viktor Tabori's, ...), you could easily automate card creation and import. I mean, think like *really* automate. You could build scripts that queries your whole database for [[date of birth]] and makes flashcards from all of them. In practice though, just having a snippet for the multi-Delta widget is enough.
* **roam/js**
  * A simple js plugin can query your flashcard database and serve all due cards to you in order, jumping from one "question" blockpage to the next. It would add a "Show answer." button, that would render the answer after clicking and unhide the Delta buttons. This way, the global filter is bypassed. 
  * You could also add extra buttons, like "Didn't know at all!" which shows you the same card in the same review session again. It could also show you stats for every card you review, and allow you to change its parameters.
* **roam/css**
  * Using custom css, you can style your review sessions anyhow you like, for example hide all elements except for the cards, or add fancy transitions. More importantly, it allows you to review comfortably on mobile.
* **Block references and "Create as block below."**
  * To do cloze deletion, just highlight what you want to hide, press ((, and select "Create as block below.". The custom css then hides all block references in the question block and replaces them with ???.

## What's so great about this
* The possible analogies to Anki are incredible. Since Delta sends each block to the future while keeping its uid, it's so beautiful that this block with its uid **is** the flashcard and all its linked references are its history (+maybe context where it was initially created).
* In my head, I'm visualizing a small widget in the top right corner, which shows you how many cards you have due today and some other stats. You could also customize your review sessions to limit your daily count to say 50. 
* Batch adding cards to Anki using .csv or tab-delimited files is great. But extensions that do something like this already exist! What's more, you could define a unified fileformat that could allow for easy import/export of cards.

## Limitations
* The review widget you choose for a prompt at the beginning stays with it. If you decide to change it somehow (like add a third button), you would need to write a script that converts all your current prompts. I don't think this is a big issue, but something to keep in mind.
* It's scary to dive head first into having a serious spaced repetition practice aiming to have thousands and thousands of cards in the future in Roam, which is not built for it. But that's what this plugin's trying to change! By using only Roam native features and importing the whole script into the graph (to be independent of external hosts), you can be sure the system you're using will work consistently. A lot needs to be done before we're at that state though.

## Top of mind
* How to most effectively make the Roam team do the following 20 min fixes to Delta?
  * ^^Independent Delta states in one block^^. This is a dealbreaker. Clicking any Delta in a block executes only the first one a bumps all. Just like when TODOs shared state.
  * Floats in increments. Michael Nielson reports his "expansion coefficient" was usually around 2.4. So, the best Delta button is {{[[∆]]:1*2.4}}.
  * Expose the Delta parameters to the rendered component, possibly using a data-tag. Would allow, for example, to change the shade of the button according to the interval. Can be worked around using a query, but direct exposure would be cleaner.
* Should clicking the "Show answer." button send you to the answer's block or just render its content in an added element?
  * Pros of staying: more fluent experience on mobile; clicking the Delta button is not buggy then
  * Cons of staying: can't edit the answer block (which you might want to) and block refs are not resolved
  * Pros of jumping: can edit the answer block
  * Cons of jumping: clicking the Delta button is buggy, since it's rendered in the breadcrumbs, so it tries to redirect back to the questions block and, what's worse, focus it, which brings up the keyboard on mobile
* Should I use React or not?
  * The top-right widget would be so clean if it used the same libraries as Roam (i.e. the React toolkit Blueprint), but that would disallow the user to easily read the plugins code and possible make some adjustements in their own graph. 
  * Using something as tippy.js seems reasonable, but I just can't get over the fact that two menus right next to each other look differently.
* Just how much should the daily review graphs should be?
  * Like, I'm thinking Roam Portal level beautifulness. I'm trying to see what web-first graphing software there is, but I already know this will be awesome.
  
## Progress & Installation
If you want to try what I have now, head over to https://roamresearch.com/#/app/notemap/page/2AEKS7QmN . Don't expect much yet.
