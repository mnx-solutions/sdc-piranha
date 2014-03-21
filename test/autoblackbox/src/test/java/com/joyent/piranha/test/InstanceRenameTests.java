package com.joyent.piranha.test;

import com.joyent.piranha.Common;
import com.joyent.piranha.pageobject.InstanceDetails;
import com.joyent.piranha.pageobject.Login;
import com.joyent.piranha.pageobject.NavBarMenu;
import com.joyent.piranha.pageobject.SideBarMenu;
import com.joyent.piranha.util.TestWrapper;
import org.junit.AfterClass;
import org.junit.BeforeClass;
import org.junit.Test;

import static com.codeborne.selenide.Condition.text;
import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Configuration.baseUrl;
import static com.codeborne.selenide.Configuration.timeout;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.open;
import static com.codeborne.selenide.Selenide.page;

public class InstanceRenameTests extends TestWrapper {

    public static final String USER_NAME = System.getProperty("loginusr");
    public static final String PASSWORD = System.getProperty("loginpw");
    public static NavBarMenu navBarMenu;
    public static SideBarMenu sideBarMenu;
    public static InstanceDetails instanceDetails;
    public static final String TEST_INSTANCE_NAME = Common.getTestInstanceName();

    @BeforeClass
    public static void openDashboard() {
        timeout = CHANGE_STATUS_TIMEOUT;
        baseUrl = BASE_URL;
        Login loginPage = open("/", Login.class);
        loginPage.login(USER_NAME, PASSWORD);
        navBarMenu = page(NavBarMenu.class);
        sideBarMenu = page(SideBarMenu.class);
        instanceDetails = sideBarMenu.clickCompute().getList().openInstanceDetails(TEST_INSTANCE_NAME);
    }

    @AfterClass
    public static void logout() {
        navBarMenu.clickAccountMenu().clickLogout();
    }

    @Test
    public void renameInstanceValidation() {
        instanceDetails.clickRenameInstanceIcon();
        instanceDetails.getInstanceNameField().sendKeys("!!!");
        instanceDetails.waitForMediumSpinnerDisappear();
        $(byText("Machine name can contain only letters, digits and signs like '.' and '-'.")).shouldBe(visible);
        instanceDetails.getInstanceNameField().clear();
        instanceDetails.getInstanceNameField().sendKeys("forFIrewallAutoTests");
        $(byText("Machine name is already in use")).shouldBe(visible);
    }

    @Test
    public void renameInstance() {
        String instName = "NewInstName";
        instanceDetails.rename(instName);
        instanceDetails.getInstanceNameField().shouldHave(text(instName));
        sideBarMenu.clickCompute().getList().openInstanceDetails(instName);
        instanceDetails.rename(Common.getTestInstanceName());
    }
}