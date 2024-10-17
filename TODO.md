# Tasks remaining:
## Combat:
1. Separate taking actions from ending the turn. 
  - Rename the Perform Action button to End Turn and make it always active.
  - When the player selects a Simple Action or a Complex Action, show a button underneath it to Take Action.

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

41. Range limits for melee attacks are not being respected. Implement these rules from the Shadowrun 5e manual:
Melee Range and Reach
The sources explain that melee combat in Shadowrun is governed by a system of Reach, which represents the effective distance at which a melee weapon or attack can connect with a target.
Here are the key rules regarding melee range and reach:
- Reach Ratings: Certain melee weapons, as well as natural attacks like those of trolls, have a Reach rating ranging from 1 to 4. This rating reflects the weapon's length or the attacker's ability to strike from a distance.
- Reach Advantage: When combatants have different Reach ratings, the difference is applied as a modifier to the defender's dice pool during a melee attack.
- Attacker with Longer Reach: If the attacker has a higher Reach rating, the defender receives a negative dice pool modifier equal to the difference in Reach. This represents the attacker's ability to strike from a safer distance, making it harder for the defender to react effectively.
- Defender with Longer Reach: If the defender has a higher Reach rating, they gain a positive dice pool modifier equal to the difference in Reach. This signifies the defender's ability to keep the attacker at bay, enhancing their defensive capabilities.
- Troll's Natural Reach: Trolls possess a natural Reach of 1, which stacks with the Reach rating of any melee weapon they wield. This reflects their larger size and longer limbs.
- Reach Doesn't Guarantee Hits: While Reach provides an advantage in melee combat, it doesn't guarantee successful hits. The attacker still needs to make a successful Melee Attack test, and the defender can still attempt to Dodge, Parry, Block, or go on Full Defense to avoid the attack.
Example:
- Scenario: A character wielding a sword (Reach 1) attacks a troll armed with a combat axe (Reach 2).
- Reach Difference: The troll has a Reach advantage of 1 (2 - 1 = 1).
- Modifier: The character attacking the troll receives a -1 dice pool modifier to their Melee Attack test due to the troll's longer reach.
Key Concepts:
- Reach is a tactical advantage: It influences the flow of melee combat by dictating engagement distances and affecting attack and defense rolls.
- Positioning is crucial: Combatants should strive to leverage their Reach advantages, while those with shorter reach should seek to close the distance or utilize defensive maneuvers to mitigate their disadvantage.

# notes

Things to check:
- Is recoil being applied correctly to the attack roll?
- Is reach for melee weapons working correctly, are the ranges for melee weapons correct?
- Are glitches being applied for all rolls?