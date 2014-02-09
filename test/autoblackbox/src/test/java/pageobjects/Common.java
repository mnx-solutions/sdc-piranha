package pageobjects;

import static com.codeborne.selenide.Condition.*;
import static com.codeborne.selenide.Selectors.byAttribute;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.$$;
import static org.junit.Assert.assertTrue;

import org.openqa.selenium.NoSuchElementException;

import com.codeborne.selenide.ElementsCollection;
import com.codeborne.selenide.SelenideElement;

import java.lang.String;

/**
 * Common interaction methods for UI elements
 */
public class Common {

    private static final int BASE_TIMEOUT = Integer.parseInt(System.getProperty("globaltimeout", "15000"));

    public static void login() {
        $(byAttribute("type", "button")).click();
        $(byAttribute("name", "username")).setValue(System.getProperty("loginusr"));
        $(byAttribute("name", "password")).setValue(System.getProperty("loginpw"));
        $("#login-submit").click();
        $(".instance_icon div.details div.number").waitWhile(hasText("0"), BASE_TIMEOUT);
    }

    public static void checkSubHeadingText(String headingText) {
        ElementsCollection headingTextContainer = $$("legend");
        assertTrue(Common.checkTextInCollection(headingTextContainer, headingText).exists());
    }

    public static void openSubHeadingEditLink(String headingText) {
        ElementsCollection headingTextContainer = $$("legend");
        Common.checkTextInCollection(headingTextContainer, headingText).$(byText("Edit")).click();
    }

    public static SelenideElement checkTextInCollection(ElementsCollection col, String filter) {
        for (SelenideElement element : col) {
            if (element.findAll(byText(filter)).size() > 0) {
                return element;
            }
        }
        throw new NoSuchElementException("Such element doesn't exist");
    }

    public static void checkHeadingText(String headingText) {
        $(".page-title").shouldHave(matchText("(.*)" + headingText + "(.*)"));
    }

    public static void clickNavigationLink(String text) {
        $(byText(text)).click();
    }

    public static void openMyAccount() {
        $(byText(System.getProperty("loginusr"))).click();
        $("ul.dropdown-menu.dd-account li", 0).$("a").click();
    }

    public static int getCollectionIndexByText(ElementsCollection col, String filter) {
        int i = 0;
        $(byText(filter)).shouldBe(visible);
        for (SelenideElement element : col) {
            if (element.findAll(byText(filter)).size() > 0) {
                return i;
            }
            i++;
        }
        throw new NoSuchElementException("Such element doesn't exist");
    }

    public static void confirmModal() {
        $(".modal").shouldBe(visible);
        $(".modal-header").exists();
        $(".modal-footer").find(byText("OK")).click();
    }

    public static void cancelModal() {
        $(".modal").shouldBe(visible);
        $(".modal-header").exists();
        $(".modal-footer").find(byText("Cancel")).click();
    }

    public static void checkBreadcrumb(String active, String right) {
        $("ul.breadcrumb li", 0).$("a").should(matchText(active));
        $("ul.breadcrumb li", 1).shouldHave(matchText("(.*)" + right));
    }

    public static void errorNotPresent() {
        if ($(".alert-error").isDisplayed()) {
            System.out.println($(".alert-error").text());
        }
    }

    public static String[] instanceProperties() {
        if (System.getProperty("datacenter").equals("us-west-x") || System.getProperty("datacenter").equals("local-x")) {
            return new String[]{
                    "base",
                    "13.3.0",
                    "Standard",
                    "Standard 0.25",
                    "A 32-bit SmartOS",
                    "256 MB",
                    "16 GB",
                    "0.125 vCPUs",
                    "$0.008",
                    "$5.84"};
        } else if (System.getProperty("datacenter").equals("us-west-1")) {
            return new String[]{
                    "base",
                    "13.2.0",
                    "Standard",
                    "Standard 0.25",
                    "A 32-bit SmartOS",
                    "256 MB",
                    "16 GB",
                    "0.125 and bursting",
                    "0.008",
                    "5.84"};
        }
        return new String[]{};
    }
}
