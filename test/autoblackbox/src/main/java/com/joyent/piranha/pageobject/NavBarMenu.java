package com.joyent.piranha.pageobject;

import com.codeborne.selenide.SelenideElement;
import org.openqa.selenium.By;

import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.page;

public class NavBarMenu extends AbstractPageObject {
    private static final String NAV_BAR_XPATH_TEMPLATE = "//ul[@class='nav']/li[contains(.,'%s')]";
    private static final String NAV_BAR_RIGHT_XPATH_TEMPLATE = "//ul[@class='nav navbar-nav pull-right']/li[contains(.,'%s')]";

    public enum NavBarHeaderElement {
        DevCenter(getSelector("DevCenter")), Support(getSelector("Support")), MyAccount(By.xpath("//ul[@class='nav navbar-nav pull-right']/li[@class='dropdown user']/a"));


        private static By getSelector(final String title) {
            return By.xpath(String.format(NAV_BAR_RIGHT_XPATH_TEMPLATE, title));
        }

        private final By selector;

        NavBarHeaderElement(By selector) {
            this.selector = selector;
        }
    }

    public enum NavBarFooterElement {
        SystemStatus(getSelector("System Status"));


        private static By getSelector(final String title) {
            return By.xpath(String.format(NAV_BAR_XPATH_TEMPLATE, title));
        }

        private final By selector;

        NavBarFooterElement(By selector) {
            this.selector = selector;
        }
    }


    public SelenideElement getNavBarElement(NavBarHeaderElement element) {
        return $(element.selector);
    }

    public AccountMenu clickAccountMenu() {
        $(NavBarHeaderElement.MyAccount.selector).click();
        return page(AccountMenu.class);
    }

    public SelenideElement getNavBarElement(NavBarFooterElement element) {
        return $(element.selector);
    }

}
