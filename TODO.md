Tasks remaining:
Combat:
Small:
- Fix wound calculation in initiative order - the total_initiative of a character should subtract their total wounds.
- Attackers should get a -2 penalty to their attack rolls if the defending character is Running
- The running and sprint conditions are not being reset when moving to the next character
- Move the weapon stats card to above the Movement card
- Fix the initiative phase arrow disappearing when moving to the next character
- In the action log, list all the inputs to the initiative rolls
- In the action log, dice rolls that are hits should be highlighted in green and 1s should be highlighted in red
- When the Melee Attack complex action is selected, show buttons for any weapons and targets instead of dropdowns
Medium:
- Highlight cover cells adjacent to the current character if they are in a path to an opposing character
Large:
- Separate taking actions from ending the turn. 
  - Rename the Perform Action button to End Turn and make it always active.
  - When the player selects a Simple Action or a Complex Action, show a button underneath it to Take Action.
- If a character has a ranged weapon, show a line from their position to all opposing characters in range
  - The line should be a different color based on the weapon's range modifier
  - The line should be gray if it intersects any Full Cover cells
  - When a player selects FireRangedWeapon, the targets should be limited by whether the line to them intersects any Full Cover cells
  - If the character has no legitimate ranged targets, the FireRangedWeapon action should be disabled

Faction Selection:
- When a character is selected for a faction, they should not appear in the other faction's available characters


Things to check:
- Is recoil being applied correctly to the attack roll?
- Is reach for melee weapons working correctly?
- Are glitches being applied for all rolls?