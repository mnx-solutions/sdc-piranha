package com.joyent.piranha.test;

import com.joyent.piranha.PropertyHolder;
import com.joyent.piranha.pageobject.*;
import com.joyent.piranha.util.TestWrapper;
import org.junit.BeforeClass;
import org.junit.Test;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.WebDriverWait;

import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Configuration.baseUrl;
import static com.codeborne.selenide.Configuration.timeout;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.*;
import static org.junit.Assert.assertTrue;

public class UploadSSHKeyTest extends TestWrapper {
    public static final String USER_NAME = PropertyHolder.getTestUserLogin();
    public static final String PASSWORD = PropertyHolder.getTestUserPassword();
    private static NavBarMenu navBarMenu;
    private static SideBarMenu sideBarMenu;

    @BeforeClass
    public static void openDashboard() {
        timeout = BASE_TIMEOUT;
        baseUrl = BASE_URL;

        Login loginPage = open("/", Login.class);
        loginPage.login(USER_NAME, PASSWORD);
        page(Dashboard.class).getFreeTierWidget().shouldBe(visible);
        navBarMenu = page(NavBarMenu.class);
        sideBarMenu = page(SideBarMenu.class);
    }

    @Test
    public void uploadKey() {
        Account account = navBarMenu.clickAccountMenu().clickAccount();
        AccountSSH accountSSH = account.getSSHContainer();
        int keys = numberOfKeys();
        accountSSH.clickImportPublicKey();
        accountSSH.uploadFile((PropertyHolder.getPublicKeyPath()));
        $(".modal").waitWhile(visible, timeout);
        checkKeysNumber(keys);
        accountSSH.clickImportPublicKey();
        accountSSH.uploadFile(PropertyHolder.getPublicKeyPath());
        $(byText("Uploaded key already exists.")).shouldBe(visible);
        accountSSH.clickButtonInModal("Ok");
        accountSSH.clickImportPublicKey();
        accountSSH.uploadFile(PropertyHolder.getServerLogPath());
        $(byText("The file you've uploaded is not a public key.")).shouldBe(visible);
        accountSSH.clickButtonInModal("Ok");
        keys = numberOfKeys();
        accountSSH.deleteTopKey();
        $(byText("Key successfully deleted.")).shouldBe(visible);
        accountSSH.clickButtonInModal("Ok");
        sideBarMenu.clickDashboard();
        navBarMenu.clickAccountMenu().clickAccount();
        assertTrue(numberOfKeys() == keys - 1);
    }

    public void checkKeysNumber(int keys) {
        WebDriverWait webDriverWait = new WebDriverWait(driver, timeout);
        final int currentKeys = keys;
        webDriverWait.until((WebDriver input) -> numberOfKeys() == currentKeys + 1);
    }

    public int numberOfKeys() {
        return $$("[data-ng-repeat=\"key in keys | reverse\"]").size();
    }
}
