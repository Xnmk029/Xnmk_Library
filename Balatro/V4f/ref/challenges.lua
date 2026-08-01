G.CHALLENGES = {
    --[[{
        name = 'TEST',
        id = 'c_test_1',
        rules = {
            custom = {
                --{id = 'no_reward'},
                {id = 'no_reward_specific', value = 'Big'},
                {id = 'no_extra_hand_money'},
                {id = 'no_interest'},
                {id = 'daily'},
                {id = 'set_seed', value = 'SEEDEEDS'},
            },
            modifiers = {
                {id = 'dollars', value = 100},
                {id = 'discards', value = 1},
                {id = 'hands', value = 6},
                {id = 'reroll_cost', value = 10},
                {id = 'joker_slots', value = 8},
                {id = 'consumable_slots', value = 3},
                {id = 'hand_size', value = 5},
            }
        },
        jokers = {
            {id = 'j_egg'},
            {id = 'j_egg'},
            {id = 'j_egg'},
            {id = 'j_egg'},
            {id = 'j_egg', edition = 'foil', eternal = true}
        },
        consumeables = {
            {id = 'c_sigil'}
        },
        vouchers = {
            {id = 'v_hieroglyph'},
        },
        deck = {
            --enhancement = 'm_glass',
            --edition = 'foil',
            --gold_seal = true,
            --yes_ranks = {['3'] = true,T = true},
            --no_ranks = {['4'] = true},
            --yes_suits = {S=true},
            --no_suits = {D=true},
            cards = {{s='D',r='2',e='m_glass',},{s='D',r='3',e='m_glass',},{s='D',r='4',e='m_glass',},{s='D',r='5',e='m_glass',},{s='D',r='6',e='m_glass',},{s='D',r='7',e='m_glass',},{s='D',r='8',e='m_glass',},{s='D',r='9',e='m_glass',},{s='D',r='T',e='m_glass',},{s='D',r='J',e='m_glass',},{s='D',r='Q',e='m_glass',},{s='D',r='K',e='m_glass',},{s='D',r='A',e='m_glass',},{s='C',r='2',e='m_glass',},{s='C',r='3',e='m_glass',},{s='C',r='4',e='m_glass',},{s='C',r='5',e='m_glass',},{s='C',r='6',e='m_glass',},{s='C',r='7',e='m_glass',},{s='C',r='8',e='m_glass',},{s='C',r='9',e='m_glass',},{s='C',r='T',e='m_glass',},{s='C',r='J',e='m_glass',},{s='C',r='Q',e='m_glass',},{s='C',r='K',e='m_glass',},{s='C',r='A',e='m_glass',},{s='H',r='2',e='m_glass',},{s='H',r='3',e='m_glass',},{s='H',r='4',e='m_glass',},{s='H',r='5',e='m_glass',},{s='H',r='6',e='m_glass',},{s='H',r='7',e='m_glass',},{s='H',r='8',e='m_glass',},{s='H',r='9',e='m_glass',},{s='H',r='T',e='m_glass',},{s='H',r='J',e='m_glass',},{s='H',r='Q',e='m_glass',},{s='H',r='K',e='m_glass',},{s='H',r='A',e='m_glass',},{s='S',r='2',e='m_glass',},{s='S',r='3',e='m_glass',},{s='S',r='4',e='m_glass',},{s='S',r='5',e='m_glass',},{s='S',r='6',e='m_glass',},{s='S',r='7',e='m_glass',},{s='S',r='8',e='m_glass',},{s='S',r='9',e='m_glass',},{s='S',r='T',e='m_glass',},{s='S',r='J',e='m_glass',},{s='S',r='Q',e='m_glass',},{s='S',r='K',e='m_glass',},{s='S',r='A',e='m_glass',},},
            type = 'Challenge Deck'
        },
        restrictions = {
            banned_cards = {
                {id = 'j_joker'},
                {id = 'j_egg'},
            },
            banned_tags = {
                {id = 'tag_garbage'},
                {id = 'tag_handy'},
            },
            banned_other = {
                {id = 'bl_wall', type = 'blind'}
            }
        }
    },]]--
    {
        name = 'The Omelette',
        id = 'c_omelette_1',
        rules = {
            custom = {
                {id = 'no_reward'},
                {id = 'no_extra_hand_money'},
                {id = 'no_interest'}
            },
            modifiers = {
            }
        },
        jokers = {
            {id = 'j_egg'},
            {id = 'j_egg'},
            {id = 'j_egg'},
            {id = 'j_egg'},
            {id = 'j_egg'},
        },
        consumeables = {
        },
        vouchers = {
        },
        deck = {
            type = 'Challenge Deck'
        },
        restrictions = {
            banned_cards = {
                {id = 'v_seed_money'},
                {id = 'v_money_tree'},
                {id = 'j_to_the_moon'},
                {id = 'j_rocket'},
                {id = 'j_golden'},
                {id = 'j_satellite'},
            },
            banned_tags = {
            },
            banned_other = {
            }
        }
    },
    {
        name = "15 Minute City",
        id = 'c_city_1',
        rules = {
            custom = {
            },
            modifiers = {
            }
        },
        jokers = {
            {id = 'j_ride_the_bus', eternal = true},
            {id = 'j_shortcut', eternal = true},
        },
        consumeables = {
        },
        vouchers = {
        },
        deck = {
            cards = {{s='D',r='4',},{s='D',r='5',},{s='D',r='6',},{s='D',r='7',},{s='D',r='8',},{s='D',r='9',},{s='D',r='T',},{s='D',r='J',},{s='D',r='Q',},{s='D',r='K',},{s='D',r='J',},{s='D',r='Q',},{s='D',r='K',},{s='C',r='4',},{s='C',r='5',},{s='C',r='6',},{s='C',r='7',},{s='C',r='8',},{s='C',r='9',},{s='C',r='T',},{s='C',r='J',},{s='C',r='Q',},{s='C',r='K',},{s='C',r='J',},{s='C',r='Q',},{s='C',r='K',},{s='H',r='4',},{s='H',r='5',},{s='H',r='6',},{s='H',r='7',},{s='H',r='8',},{s='H',r='9',},{s='H',r='T',},{s='H',r='J',},{s='H',r='Q',},{s='H',r='K',},{s='H',r='J',},{s='H',r='Q',},{s='H',r='K',},{s='S',r='4',},{s='S',r='5',},{s='S',r='6',},{s='S',r='7',},{s='S',r='8',},{s='S',r='9',},{s='S',r='T',},{s='S',r='J',},{s='S',r='Q',},{s='S',r='K',},{s='S',r='J',},{s='S',r='Q',},{s='S',r='K',}},
            type = 'Challenge Deck'
        },
        restrictions = {
            banned_cards = {
            },
            banned_tags = {
            },
            banned_other = {
            }
        }
    },
    {
        name = "Rich get Richer",
        id = 'c_rich_1',
        rules = {
            custom = {
                {id = 'chips_dollar_cap'},
            },
            modifiers = {
                {id = 'dollars', value = 100},
            }
        },
        jokers = {
        },
        consumeables = {
        },
        vouchers = {
            {id = 'v_seed_money'},
            {id = 'v_money_tree'},
        },
        deck = {
            type = 'Challenge Deck'
        },
        restrictions = {
            banned_cards = {
            },
            banned_tags = {
            },
            banned_other = {
            }
        }
    },
    {
        name = "On a Knife's Edge",
        id = 'c_knife_1',
        rules = {
            custom = {
            },
            modifiers = {
            }
        },
        jokers = {
            {id = 'j_ceremonial', eternal = true, pinned = true},
        },
        consumeables = {
        },
        vouchers = {
        },
        deck = {
            type = 'Challenge Deck'
        },
        restrictions = {
            banned_cards = {
            },
            banned_tags = {
            },
            banned_other = {
            }
        }
    },
    {
        name = "X-ray Vision",
        id = 'c_xray_1',
        rules = {
            custom = {
                {id = 'flipped_cards', value = 4},
            },
            modifiers = {
            }
        },
        jokers = {
        },
        consumeables = {
        },
        vouchers = {
        },
        deck = {
            type = 'Challenge Deck'
        },
        restrictions = {
            banned_cards = {
            },
            banned_tags = {
            },
            banned_other = {
            }
        }
    },
    {
        name = "Mad World",
        id = 'c_mad_world_1',
        rules = {
            custom = {
                {id = 'no_extra_hand_money'},
                {id = 'no_interest'},
            },
            modifiers = {
            }
        },
        jokers = {
            {id = 'j_pareidolia', edition = 'negative', eternal = true},
            {id = 'j_business', eternal = true},
        },
        consumeables = {
        },
        vouchers = {
        },
        deck = {
            cards = {{s='D',r='2',},{s='D',r='3',},{s='D',r='4',},{s='D',r='5',},{s='D',r='6',},{s='D',r='7',},{s='D',r='8',},{s='D',r='9',},{s='C',r='2',},{s='C',r='3',},{s='C',r='4',},{s='C',r='5',},{s='C',r='6',},{s='C',r='7',},{s='C',r='8',},{s='C',r='9',},{s='H',r='2',},{s='H',r='3',},{s='H',r='4',},{s='H',r='5',},{s='H',r='6',},{s='H',r='7',},{s='H',r='8',},{s='H',r='9',},{s='S',r='2',},{s='S',r='3',},{s='S',r='4',},{s='S',r='5',},{s='S',r='6',},{s='S',r='7',},{s='S',r='8',},{s='S',r='9',}},
            type = 'Challenge Deck'
        },
        restrictions = {
            banned_cards = {
            },
            banned_tags = {
            },
            banned_other = {
                {id = 'bl_plant', type = 'blind'},
            }
        }
    },
    {
        name = "Luxury Tax",
        id = 'c_luxury_1',
        rules = {
            custom = {
                {id = 'minus_hand_size_per_X_dollar', value = 5},
            },
            modifiers = {
                {id = 'hand_size', value = 10},
            }
        },
        jokers = {
        },
        consumeables = {
        },
        vouchers = {
        },
        deck = {
            type = 'Challenge Deck'
        },
        restrictions = {
            banned_cards = {
            },
            banned_tags = {
            },
            banned_other = {
            }
        }
    },
    {
        name = "Non-Perishable",
        id = 'c_non_perishable_1',
        rules = {
            custom = {
                {id = 'all_eternal'},
            },
            modifiers = {
            }
        },
        jokers = {
        },
        consumeables = {
        },
        vouchers = {
        },
        deck = {
            type = 'Challenge Deck'
        },
        restrictions = {
            banned_cards = {
                {id = 'j_gros_michel'},
                {id = 'j_ice_cream'},
                {id = 'j_cavendish'},
                {id = 'j_turtle_bean'},
                {id = 'j_ramen'},
                {id = 'j_diet_cola'},
                {id = 'j_selzer'},
                {id = 'j_popcorn'},
                {id = 'j_mr_bones'},
                {id = 'j_invisible'},
                {id = 'j_luchador'},
            },
            banned_tags = {
            },
            banned_other = {
                {id = 'bl_final_leaf', type = 'blind'},
            }
        }
    },
    {
        name = "Medusa",
        id = 'c_medusa_1',
        rules = {
            custom = {
            },
            modifiers = {
            }
        },
        jokers = {
            {id = 'j_marble', eternal = true},
        },
        consumeables = {
        },
        vouchers = {
        },
        deck = {
            type = 'Challenge Deck',
            cards = {{s='D',r='2',},{s='D',r='3',},{s='D',r='4',},{s='D',r='5',},{s='D',r='6',},{s='D',r='7',},{s='D',r='8',},{s='D',r='9',},{s='D',r='T',},{s='D',r='J',e='m_stone',},{s='D',r='Q',e='m_stone',},{s='D',r='K',e='m_stone',},{s='D',r='A',},{s='C',r='2',},{s='C',r='3',},{s='C',r='4',},{s='C',r='5',},{s='C',r='6',},{s='C',r='7',},{s='C',r='8',},{s='C',r='9',},{s='C',r='T',},{s='C',r='J',e='m_stone',},{s='C',r='Q',e='m_stone',},{s='C',r='K',e='m_stone',},{s='C',r='A',},{s='H',r='2',},{s='H',r='3',},{s='H',r='4',},{s='H',r='5',},{s='H',r='6',},{s='H',r='7',},{s='H',r='8',},{s='H',r='9',},{s='H',r='T',},{s='H',r='J',e='m_stone',},{s='H',r='Q',e='m_stone',},{s='H',r='K',e='m_stone',},{s='H',r='A',},{s='S',r='2',},{s='S',r='3',},{s='S',r='4',},{s='S',r='5',},{s='S',r='6',},{s='S',r='7',},{s='S',r='8',},{s='S',r='9',},{s='S',r='T',},{s='S',r='J',e='m_stone',},{s='S',r='Q',e='m_stone',},{s='S',r='K',e='m_stone',},{s='S',r='A',},        }
        },
        restrictions = {
            banned_cards = {
            },
            banned_tags = {
            },
            banned_other = {
            }
        }
    },
    {
        name = "Double or Nothing",
        id = 'c_double_nothing_1',
        rules = {
            custom = {
                {id = 'debuff_played_cards'},
            },
            modifiers = {
            }
        },
        jokers = {
        },
        consumeables = {
        },
        vouchers = {
        },
        deck = {
            type = 'Challenge Deck',
            cards = {{s='D',r='2',g='Red',},{s='D',r='3',g='Red',},{s='D',r='4',g='Red',},{s='D',r='5',g='Red',},{s='D',r='6',g='Red',},{s='D',r='7',g='Red',},{s='D',r='8',g='Red',},{s='D',r='9',g='Red',},{s='D',r='T',g='Red',},{s='D',r='J',g='Red',},{s='D',r='Q',g='Red',},{s='D',r='K',g='Red',},{s='D',r='A',g='Red',},{s='C',r='2',g='Red',},{s='C',r='3',g='Red',},{s='C',r='4',g='Red',},{s='C',r='5',g='Red',},{s='C',r='6',g='Red',},{s='C',r='7',g='Red',},{s='C',r='8',g='Red',},{s='C',r='9',g='Red',},{s='C',r='T',g='Red',},{s='C',r='J',g='Red',},{s='C',r='Q',g='Red',},{s='C',r='K',g='Red',},{s='C',r='A',g='Red',},{s='H',r='2',g='Red',},{s='H',r='3',g='Red',},{s='H',r='4',g='Red',},{s='H',r='5',g='Red',},{s='H',r='6',g='Red',},{s='H',r='7',g='Red',},{s='H',r='8',g='Red',},{s='H',r='9',g='Red',},{s='H',r='T',g='Red',},{s='H',r='J',g='Red',},{s='H',r='Q',g='Red',},{s='H',r='K',g='Red',},{s='H',r='A',g='Red',},{s='S',r='2',g='Red',},{s='S',r='3',g='Red',},{s='S',r='4',g='Red',},{s='S',r='5',g='Red',},{s='S',r='6',g='Red',},{s='S',r='7',g='Red',},{s='S',r='8',g='Red',},{s='S',r='9',g='Red',},{s='S',r='T',g='Red',},{s='S',r='J',g='Red',},{s='S',r='Q',g='Red',},{s='S',r='K',g='Red',},{s='S',r='A',g='Red',},}
        },
        restrictions = {
            banned_cards = {
            },
            banned_tags = {
            },
            banned_other = {
            }
        }
    },
    {
        name = "Typecast",
        id = 'c_typecast_1',
        rules = {
            custom = {
                {id = 'set_eternal_ante', value = 4},
                {id = 'set_joker_slots_ante', value = 4},
            },
            modifiers = {
            }
        },
        jokers = {
        },
        consumeables = {
        },
        vouchers = {
        },
        deck = {
            type = 'Challenge Deck'
        },
        restrictions = {
            banned_cards = {
            },
            banned_tags = {
            },
            banned_other = {
                {id = 'bl_final_leaf', type = 'blind'},
            }
        }
    },
    {
        name = "Inflation",
        id = 'c_inflation_1',
        rules = {
            custom = {
                {id = 'inflation'},
            },
            modifiers = {
            }
        },
        jokers = {
            {id = 'j_credit_card'},
        },
        consumeables = {
        },
        vouchers = {
        },
        deck = {
            type = 'Challenge Deck'
        },
        restrictions = {
            banned_cards = {
                {id = 'v_clearance_sale'},
                {id = 'v_liquidation'},
            },
            banned_tags = {
            },
            banned_other = {
            }
        }
    },
    {
        name = "Bram Poker",
        id = 'c_bram_poker_1',
        rules = {
            custom = {
                {id = 'no_shop_jokers'},
            },
            modifiers = {
            }
        },
        jokers = {
            {id = 'j_vampire', eternal = true},
        },
        consumeables = {
            {id = 'c_empress'},
            {id = 'c_emperor'},
        },
        vouchers = {
            {id = 'v_magic_trick'},
            {id = 'v_illusion'},
        },
        deck = {
            type = 'Challenge Deck',
        },
        restrictions = {
            banned_cards = {
            },
            banned_tags = {
            },
            banned_other = {
            }
        }
    },
    {
        name = "Fragile",
        id = 'c_fragile_1',
        rules = {
            custom = {
            },
            modifiers = {
            }
        },
        jokers = {
            {id = 'j_oops', eternal = true, edition = 'negative'},
            {id = 'j_oops', eternal = true, edition = 'negative'},
        },
        consumeables = {
        },
        vouchers = {
        },
        deck = {
            cards = {{s='D',r='2',e='m_glass',},{s='D',r='3',e='m_glass',},{s='D',r='4',e='m_glass',},{s='D',r='5',e='m_glass',},{s='D',r='6',e='m_glass',},{s='D',r='7',e='m_glass',},{s='D',r='8',e='m_glass',},{s='D',r='9',e='m_glass',},{s='D',r='T',e='m_glass',},{s='D',r='J',e='m_glass',},{s='D',r='Q',e='m_glass',},{s='D',r='K',e='m_glass',},{s='D',r='A',e='m_glass',},{s='C',r='2',e='m_glass',},{s='C',r='3',e='m_glass',},{s='C',r='4',e='m_glass',},{s='C',r='5',e='m_glass',},{s='C',r='6',e='m_glass',},{s='C',r='7',e='m_glass',},{s='C',r='8',e='m_glass',},{s='C',r='9',e='m_glass',},{s='C',r='T',e='m_glass',},{s='C',r='J',e='m_glass',},{s='C',r='Q',e='m_glass',},{s='C',r='K',e='m_glass',},{s='C',r='A',e='m_glass',},{s='H',r='2',e='m_glass',},{s='H',r='3',e='m_glass',},{s='H',r='4',e='m_glass',},{s='H',r='5',e='m_glass',},{s='H',r='6',e='m_glass',},{s='H',r='7',e='m_glass',},{s='H',r='8',e='m_glass',},{s='H',r='9',e='m_glass',},{s='H',r='T',e='m_glass',},{s='H',r='J',e='m_glass',},{s='H',r='Q',e='m_glass',},{s='H',r='K',e='m_glass',},{s='H',r='A',e='m_glass',},{s='S',r='2',e='m_glass',},{s='S',r='3',e='m_glass',},{s='S',r='4',e='m_glass',},{s='S',r='5',e='m_glass',},{s='S',r='6',e='m_glass',},{s='S',r='7',e='m_glass',},{s='S',r='8',e='m_glass',},{s='S',r='9',e='m_glass',},{s='S',r='T',e='m_glass',},{s='S',r='J',e='m_glass',},{s='S',r='Q',e='m_glass',},{s='S',r='K',e='m_glass',},{s='S',r='A',e='m_glass',},},
            type = 'Challenge Deck'
        },
        restrictions = {
            banned_cards = {
                {id = 'c_magician'},
                {id = 'c_empress'},
                {id = 'c_heirophant'},
                {id = 'c_chariot'},
                {id = 'c_devil'},
                {id = 'c_tower'},
                {id = 'c_lovers'},
                {id = 'c_incantation'},
                {id = 'c_grim'},
                {id = 'c_familiar'},
                {id = 'p_standard_normal_1', ids = {
                    'p_standard_normal_1','p_standard_normal_2','p_standard_normal_3','p_standard_normal_4','p_standard_jumbo_1','p_standard_jumbo_2','p_standard_mega_1','p_standard_mega_2',
                }},
                {id = 'j_marble'},
                {id = 'j_vampire'},
                {id = 'j_midas_mask'},
                {id = 'j_certificate'},
                {id = 'v_magic_trick'},
                {id = 'v_illusion'},
            },
            banned_tags = {
                {id = 'tag_standard'},
            },
            banned_other = {
            }
        }
    },
    {
        name = "Monolith",
        id = 'c_monolith_1',
        rules = {
            custom = {
            },
            modifiers = {
            }
        },
        jokers = {
            {id = 'j_obelisk', eternal = true},
            {id = 'j_marble', eternal = true, edition = 'negative'},
        },
        consumeables = {
        },
        vouchers = {
        },
        deck = {
            type = 'Challenge Deck'
        },
        restrictions = {
            banned_cards = {
            },
            banned_tags = {
            },
            banned_other = {
            }
        }
    },
    {
        name = "Blast Off",
        id = 'c_blast_off_1',
        rules = {
            custom = {
            },
            modifiers = {
                {id = 'hands', value = 2},
                {id = 'discards', value = 2},
                {id = 'joker_slots', value = 4},
            }
        },
        jokers = {
            {id = 'j_constellation', eternal = true},
            {id = 'j_rocket', eternal = true},
        },
        consumeables = {
        },
        vouchers = {
            {id = 'v_planet_merchant'},
            {id = 'v_planet_tycoon'},
        },
        deck = {
            type = 'Challenge Deck'
        },
        restrictions = {
            banned_cards = {
                {id = 'v_grabber'},
                {id = 'v_nacho_tong'},
                {id = 'j_burglar'},
            },
            banned_tags = {
            },
            banned_other = {
            }
        }
    },
    {
        name = "Five-Card Draw",
        id = 'c_five_card_1',
        rules = {
            custom = {
            },
            modifiers = {
                {id = 'hand_size', value = 5},
                {id = 'joker_slots', value = 7},
                {id = 'discards', value = 6},
            }
        },
        jokers = {
            {id = 'j_card_sharp'},
            {id = 'j_joker'},
        },
        consumeables = {
        },
        vouchers = {
        },
        deck = {
            type = 'Challenge Deck'
        },
        restrictions = {
            banned_cards = {
                {id = 'j_juggler'},
                {id = 'j_troubadour'},
                {id = 'j_turtle_bean'},
            },
            banned_tags = {
            },
            banned_other = {
            }
        }
    },
    {
        name = "Golden Needle",
        id = 'c_golden_needle_1',
        rules = {
            custom = {
                {id = 'discard_cost', value = 1},
            },
            modifiers = {
                {id = 'hands', value = 1},
                {id = 'discards', value = 6},
                {id = 'dollars', value = 10},
            }
        },
        jokers = {
            {id = 'j_credit_card'},
        },
        consumeables = {
        },
        vouchers = {
        },
        deck = {
            type = 'Challenge Deck'
        },
        restrictions = {
            banned_cards = {
                {id = 'v_grabber'},
                {id = 'v_nacho_tong'},
                {id = 'j_burglar'},
            },
            banned_tags = {
            },
            banned_other = {
            }
        }
    },
    {
        name = "Cruelty",
        id = 'c_cruelty_1',
        rules = {
            custom = {
                {id = 'no_reward_specific', value = 'Small'},
                {id = 'no_reward_specific', value = 'Big'},
            },
            modifiers = {
                {id = 'joker_slots', value = 3},
            }
        },
        jokers = {
        },
        consumeables = {
        },
        vouchers = {
        },
        deck = {
            type = 'Challenge Deck'
        },
        restrictions = {
            banned_cards = {
            },
            banned_tags = {
            },
            banned_other = {
            }
        }
    },
    {
        name = "Jokerless",
        id = 'c_jokerless_1',
        rules = {
            custom = {
                {id = 'no_shop_jokers'},
            },
            modifiers = {
                {id = 'joker_slots', value = 0},
            }
        },
        jokers = {
        },
        consumeables = {
        },
        vouchers = {
        },
        deck = {
            type = 'Challenge Deck'
        },
        restrictions = {
            banned_cards = {
                {id = 'c_judgement'},
                {id = 'c_wraith'},
                {id = 'c_soul'},
                {id = 'v_antimatter'},
                {id = 'p_buffoon_normal_1', ids = {
                    'p_buffoon_normal_1','p_buffoon_normal_2','p_buffoon_jumbo_1','p_buffoon_mega_1',
                }},
            },
            banned_tags = {
                {id = 'tag_rare'},
                {id = 'tag_uncommon'},
                {id = 'tag_holo'},
                {id = 'tag_polychrome'},
                {id = 'tag_negative'},
                {id = 'tag_foil'},
                {id = 'tag_buffoon'},
                {id = 'tag_top_up'},

            },
            banned_other = {
                {id = 'bl_final_acorn', type = 'blind'},
                {id = 'bl_final_heart', type = 'blind'},
                {id = 'bl_final_leaf', type = 'blind'}
            }
        }
    },
}
