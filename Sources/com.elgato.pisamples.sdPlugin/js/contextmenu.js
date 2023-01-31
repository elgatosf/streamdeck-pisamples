var contextMenuClassName = "context-menu";
var contextMenuItemClassName = "context-menu__item";
var contextMenuLinkClassName = "context-menu__link";
var contextMenuActive = "context-menu--active";

var triggerItemClassName = "context-menu__trigger";
/**
* Turns the custom context menu on.
*/
function toggleMenuOn(contextMenu) {
	if( !contextMenu.classList.contains(contextMenuActive)){
		contextMenu.classList.add( contextMenuActive );
	}
}

/**
* Turns the custom context menu off.
*/
function toggleMenuOff(contextMenu) {
	if (contextMenu.classList.contains(contextMenuActive)){
		contextMenu.classList.remove( contextMenuActive );
	}
}


function positionMenu(menu, xPos, yPos){
	menuWidth = menu.offsetWidth + 4;
    menuHeight = menu.offsetHeight + 4;

    windowWidth = window.innerWidth;
    windowHeight = window.innerHeight;

    if ( (windowWidth - xPos) < menuWidth ) {
      menu.style.left = windowWidth - menuWidth + "px";
    } else {
      menu.style.left = xPos + "px";
    }

    if ( (windowHeight - yPos) < menuHeight ) {
      menu.style.top = windowHeight - menuHeight + "px";
    } else {
      menu.style.top = yPos + "px";
	}
}

function openContextMenu(contextMenuId, xPos, yPos){
	console.log("openContextMenu called");
	var contextMenu = document.getElementById(contextMenuId);
	
	toggleMenuOn(contextMenu);
	positionMenu(contextMenu, xPos, yPos);
	
	document.addEventListener('click', function(){ 
		toggleMenuOff(contextMenu);		
	}, true);
}
