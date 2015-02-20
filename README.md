# YNAWB
A proof-of-concept web-based portal for viewing your YNAB budgets. I thought it would be fun to attempt to mimic the desktop version of YNAB and see if I could adapt it for the web. That being said, I mostly wanted to add the ability for this to be a viewer into your YNAB budgets, not so much the ability to edit them. My main motivation for this being I really, ***really*** don't want to screw up your budgets. Another motivation is that I don't intend for this to be feature complete in any sense of the word or for it to ever see any traffic other than myself and a couple other people. The YNAB team is working on a  web-based SASS service so give them your business when it's ready (they deserve it!). I just thought this would be a fun exercise. 

With that in mind, this project may be taken down soon. Like I said, the YNAB team is currently working on a SASS version of their software and I fully intend on using it in the future to support them. Like I said earlier, this is a proof-of-concept.

All things being said, there are some differences between the desktop client and this web-based version, including things I just haven't implemented. Some of the more glaring issues are:

* The ability to edit anything at all. Nope. Not going to do it. Sorry.
* Reports. This is something I simply haven't gotten around to yet. I wanted to get the main budget and transaction view in a decent state first.
* The ability to navigate months. Going to attempt to add once I get Dropbox linked.
* Transaction view when clicking on outflows for a budget category. This is pretty low on the list, but not terribly difficult.
* Filter transactions by account. Right now all transactions are shown in the transaction list with no regard for the account you've selected in the sidebar. I will hopefully get this fixed soon. 
* Filtering transactions at all.
* Pinning the budget summary and transaction column headers to the top. We'll see...
* Tons of other small features.

Something else to mention is that this has only really been tested on my local budgets and some dummy budgets I've created. There may be some edge cases I haven't worked out yet so don't be surprised if you notice some small issues.