export function createDemo() {
  return {
    id: 'demo',
    title: 'The Lantern at Blackthorn Gate',
    isDemo: true,
    firstPage: 1,
    coverPage: 1,
    cover: null,
    pages: [
      'At the edge of the village, where the cobblestones give way to tangled roots, you find a lantern burning with a pale green flame.\n\nA note hangs from its handle: "The gate opens only for those who choose."\n\nBeyond the old iron gate, two paths disappear into Blackthorn Wood. To the left, you hear a bell ringing deep among the trees. To the right, a trail of silver footprints leads down toward the river.\n\nIf you follow the sound of the bell, turn to page 3.\n\nIf you follow the silver footprints, turn to page 5.',
      'You pause to examine the lantern. Beneath its base, someone has scratched a tiny map: a bridge, a tower, and a star.\n\nThis may be worth remembering.\n\nTo enter the wood, turn to page 3. To take the river path, turn to page 5.',
      'The bell stops as you step into a clearing. A crooked tower rises above you, its doorway just wide enough for a traveler.\n\nAn owl on the lintel opens one amber eye. "Have you brought a light?" it asks.\n\nTo lift the green lantern, turn to page 6.\n\nTo leave the tower and seek the river, turn to page 5.',
      'You hold your breath and cross the bridge. The stars reflected in the water rise into the air, one by one, until they form an arch above the far bank.\n\nBeyond it lies the road home. In your pocket you find a small silver key, still warm from the lantern flame.\n\nYour adventure ends here. There are other paths to discover.',
      'The silver footprints end at a narrow wooden bridge. A fox in a faded velvet coat waits beside it.\n\n"The toll," says the fox, "is one good story. Or a little courage."\n\nTo tell the fox about the lantern, turn to page 6.\n\nTo cross the bridge without looking down, turn to page 4.',
      'The green flame flares, and for a moment you see the wood as it was a hundred years ago: bright windows, open roads, and travelers gathering beneath the tower.\n\n"You remembered us," says a voice. The lantern becomes an ordinary light, but the way ahead is clear.\n\nBy dawn you are home, with a story no one quite believes.\n\nTHE END\n\nRestart the book to discover another path.',
    ],
  };
}
