<?php

namespace dokuwiki\plugin\commentmargin;

use dokuwiki\Menu\Item\AbstractItem;

/**
 * Class MenuItem
 * Implements the margin comment button for DokuWiki's menu system
 */
class MenuItem extends AbstractItem
{
    /** @var string action identifier */
    protected $type = 'commentmargin';

    /** @var string icon file */
    protected $svg = __DIR__ . '/comment.svg';

    public function __construct()
    {
        parent::__construct();
    }

    public function getLabel()
    {
        $hlp = plugin_load('action', 'commentmargin');
        return $hlp ? $hlp->getLang('add_comment') : 'Add comment';
    }

    public function useLabel()
    {
        return true;
    }

    public function getLinkAttributes($classprefix = 'action ')
    {
        global $ID;
        return [
            'href' => wl($ID, ['do' => 'commentmargin'], false, '&'),
            'id' => 'commentmargin-add-btn',
            'title' => $this->getLabel(),
            'class' => $classprefix . $this->type,
            'rel' => 'nofollow'
        ];
    }
}
