<?php
/**
 * Plugin CommentMargin: Add some comment on the margin of a page
 * Author: Raynald de Lahondès
*/


if (!defined('DOKU_INC')) die();

class action_plugin_commentmargin extends DokuWiki_Action_Plugin {



    public function register(Doku_Event_Handler $controller) {
        $controller->register_hook('TPL_METAHEADER_OUTPUT', 'BEFORE', $this, 'inject_translation_script');
        $controller->register_hook('TPL_CONTENT_DISPLAY', 'AFTER', $this, 'handle_render_comments');
        $controller->register_hook('TPL_SITE_ACTIONS', 'AFTER', $this, 'handle_site_actions');
        $controller->register_hook('MENU_ITEMS_ASSEMBLY', 'AFTER', $this, 'addsvgbutton');
    }

    public function inject_translation_script(Doku_Event $event, $param) {
        $translations = [
            'js_select_text' => $this->getLang('js_select_text'),
            'js_enter_comment' => $this->getLang('js_enter_comment')
        ];

        echo '<script>window.COMMENTMARGIN_LANG = ' . json_encode($translations) . ';</script>';
    }

    /**
     * Injecte les ancres et les surlignages dans le HTML rendu
     */
    public function handle_render_comments(Doku_Event $event, $param) {
        global $ID;

        $html = & $event->data;
        $comments = $this->loadComments($ID);

        foreach ($comments as $comment) {
            $needle = $comment['selected'];
            $anchor = $comment['anchor_id'];
            $replacement = '<span id="' . hsc($anchor) . '" class="comment-highlight">' . hsc($needle) . '</span>';

            // Remplace la première occurrence uniquement
            $html = preg_replace('/' . preg_quote($needle, '/') . '/', $replacement, $html, 1);
        }

        $html .= '<script src="' . DOKU_BASE . 'lib/plugins/commentmargin/script.js"></script>';
        $html .= '<link rel="stylesheet" href="' . DOKU_BASE . 'lib/plugins/commentmargin/style.css">';
    }

    /**
     * Ajoute une icône dans la barre d'actions du site
     */
    public function handle_site_actions(Doku_Event $event, $param) {
        echo "<!-- commentmargin hook reached -->";

        if (auth_quickaclcheck(getID()) < AUTH_EDIT) return;

        echo '<li class="plugin_commentmargin">';
        echo '<a href="#" id="commentmargin-add-btn" title="add_comment">';
        echo '<span class="icon">💬</span>';
        echo '</a></li>';
    }

    /**
     * Charge les commentaires depuis le fichier .comments
     */
    private function loadComments($pageid) {
        $path = metaFN($pageid, ".comments");
        if (!file_exists($path)) return [];
        $json = file_get_contents($path);
        return json_decode($json, true) ?: [];
    }


    public function addsvgbutton(Doku_Event $event, $param) {
        global $INFO;
        if ($event->data['view'] !== 'page') return;
        if (!$INFO['exists']) return;

        $event->data['items'][] = new \dokuwiki\plugin\commentmargin\MenuItem();
    }
}
