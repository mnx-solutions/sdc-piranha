package com.joyent.piranha.test.rbac;


import com.codeborne.selenide.SelenideElement;
import com.joyent.piranha.Common;
import com.joyent.piranha.PropertyHolder;
import com.joyent.piranha.pageobject.*;
import com.joyent.piranha.util.TestWrapper;
import org.junit.AfterClass;
import org.junit.BeforeClass;
import org.junit.Test;

import static com.codeborne.selenide.Condition.exist;
import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Configuration.baseUrl;
import static com.codeborne.selenide.Configuration.timeout;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.*;
import static org.junit.Assert.assertTrue;

public class RoleTest extends TestWrapper {
    public static SideBarMenu sideBarMenu;
    public static NavBarMenu navBarMenu;

    @BeforeClass
    public static void openDashboard() {
        timeout = Long.parseLong(PropertyHolder.getGlobalTimeout());
        baseUrl = PropertyHolder.getBaseUrl();
        sideBarMenu = page(SideBarMenu.class);
        navBarMenu = page(NavBarMenu.class);
        Login loginPage = open("/", Login.class);
        loginPage.login(PropertyHolder.getTestUserLogin(), PropertyHolder.getTestUserPassword());
    }

    @AfterClass
    public static void cleanUp() throws InstantiationException, IllegalAccessException {
        sideBarMenu.clickRoles();
        Common.cleanUpGrid(Roles.class);
        navBarMenu.clickAccountMenu().clickLogout();
    }

    @Test
    public void createRoleValidation() {
        Roles roles = sideBarMenu.clickRoles();
        CreateRole createRole = roles.clickCreateRole();
        createRole.clickCreateRole();
        $(byText("Missing name")).shouldBe(visible);
        createRole.setName("!");
        $(byText("Name can contain only letters, digits, spaces and signs like \".\" and \"-\"")).shouldBe(visible);
    }

    @Test
    public void createRole() {
        Roles roles = sideBarMenu.clickRoles();
        String roleName = roles.createTestRole();
        $(Roles.grid).$(byText(roleName)).shouldBe(visible);
    }

    @Test
    public void changeRoleInformation() {
        Roles roles = sideBarMenu.clickRoles();
        String roleName = roles.createTestRole();
        RoleDetails roleDetails = roles.openRoleDetails(roleName);
        String newRoleName = "newRoleName" + System.currentTimeMillis();
        roleDetails.setName(newRoleName);
        roleDetails.clickSave();
        $(Roles.grid).$(byText(newRoleName)).shouldBe(visible);
    }

    @Test
    public void deleteRole() {
        Roles roles = sideBarMenu.clickRoles();
        String roleName = roles.createTestRole();
        RoleDetails roleDetails = roles.openRoleDetails(roleName);
        roleDetails.clickDelete();
        roleDetails.clickButtonInModal("Yes");
        roles.waitForLargeSpinnerDisappear();
        $(Roles.grid).$(byText(roleName)).shouldNot(exist);
    }

    @Test
    public void deleteRoleFromGrid() {
        Roles roles = sideBarMenu.clickRoles();
        String roleName = roles.createTestRole();
        SelenideElement row = roles.getRowByText("object in pagedItems", roleName);
        row.$(".checkbox").click();
        roles.performAction("Delete");
        roles.clickButtonInModal("Yes");
        roles.waitForLargeSpinnerDisappear();
        $(Roles.grid).$(byText(roleName)).shouldNot(exist);
    }

    @Test
    public void addSubuserToRole() {
        String user = sideBarMenu.clickAccount().createTestSubUser();
        Roles roles = sideBarMenu.clickRoles();
        String roleName = roles.createTestRole();
        RoleDetails roleDetails = roles.openRoleDetails(roleName);
        roleDetails.addUser(user);
        roleDetails.clickSave();
        roleDetails.waitForLargeSpinnerDisappear();
        assertTrue(roles.getRowByText("object in pagedItems", roleName).text().contains(user));
    }

    @Test
    public void addPolicy() {
        Policies policies = sideBarMenu.clickPolicies();
        String policyName = policies.createTestPolicy();
        Roles roles = sideBarMenu.clickRoles();
        String roleName = roles.createTestRole();
        RoleDetails roleDetails = roles.openRoleDetails(roleName);
        roleDetails.addPolicy(policyName);
        roleDetails.clickSave();
        assertTrue(roles.getRowByText("object in pagedItems", roleName).text().contains(policyName));
    }
}
