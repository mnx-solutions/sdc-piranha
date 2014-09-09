package com.joyent.piranha.test.rbac;


import com.codeborne.selenide.SelenideElement;
import com.joyent.piranha.Common;
import com.joyent.piranha.PropertyHolder;
import com.joyent.piranha.pageobject.*;
import org.junit.AfterClass;
import org.junit.Before;
import org.junit.BeforeClass;
import org.junit.Test;

import static com.codeborne.selenide.Condition.exist;
import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Configuration.baseUrl;
import static com.codeborne.selenide.Configuration.timeout;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.*;
import static org.junit.Assert.assertTrue;

public class SubuserTest extends AbstractPageObject {
    public static final Users USERS = page(Users.class);
    public static SideBarMenu sideBarMenu;
    public static NavBarMenu navBarMenu;
    public static CreateSubUser createSubUser;

    @BeforeClass
    public static void openDashboard() {
        timeout = Long.parseLong(PropertyHolder.getGlobalTimeout());
        baseUrl = PropertyHolder.getBaseUrl();
        sideBarMenu = page(SideBarMenu.class);
        navBarMenu = page(NavBarMenu.class);
        Login loginPage = open("/", Login.class);
        loginPage.login(PropertyHolder.getTestUserLogin(), PropertyHolder.getTestUserPassword());
    }

    @Before
    public void openUsers() {
        Users users = sideBarMenu.clickAccount();
        createSubUser = users.clickCreateUser();
    }

    @AfterClass
    public static void cleanUp() throws InstantiationException, IllegalAccessException {
        sideBarMenu.clickAccount();
        Common.cleanUpGrid(Users.class);
        navBarMenu.clickAccountMenu().clickLogout();
    }

    @Test
    public void createSubUserValidation() {
        createSubUser.clickCreateUser();
        $(byText("Missing email address"));
        $(byText("Missing Username"));
        $(byText("Please enter password."));
        $(byText("Please confirm your password."));
        createSubUser.setUsername("q");
        $(byText("Username too short."));
        createSubUser.setEmailAddress("q");
        $(byText("Please provide valid email address."));
        createSubUser.setPassword("q");
        $(byText("Must contain letters and numbers."));
        createSubUser.setRepeatPassword("w");
        $(byText("Passwords don't match."));
    }

    @Test
    public void createSubUser() {
        String username = USERS.createTestSubUser();
        createSubUser.waitForLargeSpinnerDisappear();
        $(Users.grid).$(byText(username)).shouldBe(visible);
    }

    @Test
    public void updateSubUserInfo() {
        String username = USERS.createTestSubUser();
        String emailAddress = "newEmail" + System.currentTimeMillis() + "@q.q";
        SubuserDetails subuserDetails = USERS.openSubuserDetails(username);
        subuserDetails.setEmailAddress(emailAddress);
        subuserDetails.clickSave();
        $(Users.grid).$(byText(emailAddress)).shouldBe(visible);
    }

    @Test
    public void deleteSubUser() {
        String username = USERS.createTestSubUser();
        SubuserDetails subuserDetails = USERS.openSubuserDetails(username);
        subuserDetails.checkTitle();
        subuserDetails.clickDelete();
        subuserDetails.clickButtonInModal("Yes");
        subuserDetails.waitForLargeSpinnerDisappear();
        $(Users.grid).$(byText(username)).shouldNot(exist);
    }

    @Test
    public void changePassword() {
        CreatePolicy createPolicy = sideBarMenu.clickPolicies().clickCreatePolicy();
        String policy = "policy" + System.currentTimeMillis();
        createPolicy.setName(policy);
        createPolicy.addRule("can getuser");
        createPolicy.clickCreatePolicy();
        String role = sideBarMenu.clickRoles().createTestRole();
        RoleDetails roleDetails = page(Roles.class).openRoleDetails(role);
        roleDetails.addPolicy(policy);
        roleDetails.clickSave();
        sideBarMenu.clickAccount();
        String username = USERS.createTestSubUser();
        SubuserDetails subuserDetails = USERS.openSubuserDetails(username);
        subuserDetails.clickChangePassword();
        String password = "pass" + System.currentTimeMillis();
        subuserDetails.setPassword(password);
        subuserDetails.setRepeatPassword(password);
        subuserDetails.clickButtonInModal("Change Password");
        subuserDetails.assignRole(role);
        subuserDetails.clickSave();
        sleep(5000); //role applies in background with no indication and this takes time
        navBarMenu.clickAccountMenu().clickLogout();
        Login login = open("/", Login.class);
        login.login(PropertyHolder.getTestUserLogin() + "/" + username, password);
        page(Dashboard.class).checkTitle();
        navBarMenu.clickAccountMenu().clickLogout();
        login.login(PropertyHolder.getTestUserLogin(), PropertyHolder.getTestUserPassword());
    }

    @Test
    public void assignRole() {
        String username = USERS.createTestSubUser();
        Roles roles = sideBarMenu.clickRoles();
        roles.clickCreateRole();
        String roleName = roles.createTestRole();
        sideBarMenu.clickAccount();
        SubuserDetails subuserDetails = USERS.openSubuserDetails(username);
        subuserDetails.assignRole(roleName);
        subuserDetails.clickSave();
        SelenideElement row = USERS.getRowByText("object in pagedItems", username);
        assertTrue(row.text().contains(roleName));
    }

    @Test
    public void deleteSubuserFromGrid() {
        String username = USERS.createTestSubUser();
        SelenideElement row = USERS.getRowByText("object in pagedItems", username);
        row.$(".checkbox").click();
        USERS.performAction("Delete");
        USERS.clickButtonInModal("Yes");
        USERS.waitForLargeSpinnerDisappear();
        $(Users.grid).$(byText(username)).shouldNot(exist);
    }

    @Test
    public void checkAutocompletedSubuserInfo() {
        String username = USERS.createTestSubUser();
        EditBillingInformation editBillingInformation = navBarMenu.clickAccountMenu().clickAccount().clickEditBilling();
        editBillingInformation.waitForPageLoading();

        String address = editBillingInformation.getAddress();
        String country = editBillingInformation.getCountry();
        String city = editBillingInformation.getCity();
        String state = editBillingInformation.getState();
        String zip = editBillingInformation.getZip();
        String companyName = navBarMenu.clickAccountMenu().clickAccount().clickEditProfile().getCompanyName();

        SubuserDetails subuserDetails = sideBarMenu.clickAccount().openSubuserDetails(username);
        assertTrue(subuserDetails.getAddress().equals(address));
        assertTrue(subuserDetails.getCountry().equals(country));
        assertTrue(subuserDetails.getCity().equals(city));
        assertTrue(subuserDetails.getState().equals(state));
        assertTrue(subuserDetails.getZip().equals(zip));
        assertTrue(subuserDetails.getCompanyName().equals(companyName));
    }
}
