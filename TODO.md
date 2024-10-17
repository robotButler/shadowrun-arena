# Tasks remaining:
## Combat:
1. Separate taking actions from ending the turn. 
  - Rename the Perform Action button to End Turn and make it always active.
  - When the player selects a Simple Action or a Complex Action, show a button underneath it to Take Action.

10. Faction Selection:
- When a character is selected for a faction, they should not appear in the other faction's available characters

22. Implement the "Call Shot" action.

40. I got this action log entry: ```
chef fired at zel with ares and dealt 0 damage.
Ranged Attack: Assault Rifle, Range: -1m (Short, 0 modifier)

Attack Pool: Base pool (12) = Total attack pool (12)

Attack rolls: 3, 2, 3, 5, 3, 6, 3, 1, 5, 1, 2, 4 3, 2, 3, 5, 3, 6, 3, 1, 5, 1, 2, 4

Defense: Base pool (6) = Total defense pool (6)

Defense rolls: 5, 6, 2, 3, 5, 3 5, 6, 2, 3, 5, 3

Net hits: 3 - 3 = 0

Attack missed. ```
The dice rolls are being printed twice. The first one has proper highlighting so remove the second one.

41. Range limits for melee attacks are not being respected.

# notes

Things to check:
- Is recoil being applied correctly to the attack roll?
- Is reach for melee weapons working correctly, are the ranges for melee weapons correct?
- Are glitches being applied for all rolls?